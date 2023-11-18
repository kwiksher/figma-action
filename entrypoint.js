require('dotenv').config();
const got = require('got')
const {ensureDir, writeFile} = require('fs-extra')
const {join, resolve} = require('path')
const Figma = require('figma-js')
const {FIGMA_TOKEN, FIGMA_FILE_URL} = process.env
const PQueue = require('p-queue')
const sanitize = require("sanitize-filename")

const options = {
  format: 'jpg',
  outputDir: './build/',
  scale: '1'
}

for(const arg of process.argv.slice(2)) {
  const [param, value] = arg.split('=')
  if(options[param]) {
    options[param] = value
  }
}

if(!FIGMA_TOKEN) {
  throw Error('Cannot find FIGMA_TOKEN in process!')
}

console.log("###",FIGMA_FILE_URL)

const client = Figma.Client({
  personalAccessToken: FIGMA_TOKEN
})

// Fail if there's no figma file key
let fileId = null
if (!fileId) {
  try {
    fileId = FIGMA_FILE_URL.match(/file\/([a-z0-9]+)\//i)[1]
  } catch (e) {
    throw Error('Cannot find FIGMA_FILE_URL key in process!')
  }
}

const yaml = require('js-yaml');
const fs   = require('fs');

// Get document, or throw exception on error
try {
  const doc = yaml.load(fs.readFileSync('./frames.yml', 'utf8'));
  console.log(doc);
  for(const target of doc.frames ){
    exportFrame(target, doc);
  }
} catch (e) {
  console.log(e);
}

function exportFrame(target, doc){
  let outputDir = options.outputDir + target;
  let frame_x = 0;
  let frame_y = 0;
  //
  console.log(`Exporting ${FIGMA_FILE_URL} components`)
  client.file(fileId)
    .then(({ data }) => {
      console.log('Processing response')
      const components = {}
      let isTargetFound = false;
      function check(c) {
        // if (c.type === 'COMPONENT') {
          if (c.hasOwnProperty('exportSettings') && c.exportSettings.length>0 ){
          const {name, id} = c
          // const {description = '', key} = data.components[c.id]
          const {width, height} = c.absoluteBoundingBox
          const filename = `${sanitize(name).toLowerCase()}.${options.format}`;
          const x = c.absoluteBoundingBox.x - frame_x;
          const y = c.absoluteBoundingBox.y - frame_y;
          if (options.format == c.exportSettings[0].format.toLowerCase()){
            components[id] = {
              name,
              filename,
              id,
              // key,
              file: fileId,
              // description,
              width,
              height,
              x,
              y
            }
          }
        } else if (c.children) {
            // console.log(c)
            if (c.type == "CANVAS" && doc.page==c.name) {
              // eslint-disable-next-line github/array-foreach
              c.children.forEach(check)
            }else if(c.type == "SECTION" && doc.section == c.name ){
              c.children.forEach(check)
            }else if (c.type == "FRAME"  && target == c.name){
              frame_x = c.absoluteBoundingBox.x;
              frame_y = c.absoluteBoundingBox.y;
              isTargetFound = true;
              c.children.forEach(check)
              isTargetFound = false;
            }else if (isTargetFound){
              c.children.forEach(check)
            }
        }
      }

      data.document.children.forEach(check)
      if (Object.values(components).length === 0) {
        throw Error('No components found! check ' + doc.page + ">" + doc.section + ">" + target)
      }
      console.log(`${Object.values(components).length} ${options.format} exports found in the figma file`)
      return components
    })
    .then(components => {
      console.log('Getting export urls')
      return client.fileImages(
        fileId,
        {
          format: options.format,
          ids: Object.keys(components),
          scale: options.scale
        }
      ).then(({data}) => {
        for(const id of Object.keys(data.images)) {
          components[id].image = data.images[id]
        }
        return components
      })
    })
    .then(components => {
      return ensureDir(join(outputDir))
        .then(() => writeFile(resolve(outputDir, `data.${options.format}.json`), JSON.stringify(components), 'utf8'))
        .then(() => components)
    })
    .then(components => {
      const contentTypes = {
        'svg': 'image/svg+xml',
        'png': 'image/png',
        'jpg': 'image/jpeg'
      }
      return queueTasks(Object.values(components).map(component => () => {
        return got.get(component.image, {
          headers: {
            'Content-Type': contentTypes[options.format]
          },
          encoding: (options.format === 'svg' ? 'utf8' : null)
        })
        .then(response => {
          return ensureDir(join(outputDir, options.format))
            .then(() => writeFile(join(outputDir, options.format, component.filename), response.body, (options.format === 'svg' ? 'utf8' : 'binary')))
        })
      }))
    })
    .catch(error => {
      throw Error(`Error fetching components from Figma: ${error}`)
    })
}

function queueTasks(tasks, options) {
  const queue = new PQueue(Object.assign({concurrency: 3}, options))
  for (const task of tasks) {
    queue.add(task)
  }
  queue.start()
  return queue.onIdle()
}
