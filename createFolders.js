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
  outputDir: './dist/',
  page: 'Page 1'
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

console.log("###", FIGMA_FILE_URL)

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

if (options.page){
  exportFrame(options.page)
}else{
  throw Error('Cannot find FIGMA Page in argv, set like page="Page 1"')
}

function exportFrame(page){
  let outputDir = options.outputDir + '/' + page;
  //
  console.log(`Exporting ${FIGMA_FILE_URL} section`)
  client.file(fileId)
    .then(({ data }) => {
      console.log('Processing response')
      const components = {}
      //
      function check(c) {
        if (c.type === 'SECTION') {
          const {name, id} = c
          const filename = `${sanitize(name).toLowerCase()}.${options.format}`;
          // const {description = '', key} = data.components[c.id]
          components[id] = {
            name,
            filename,
            id,
            file: fileId,
            children:[]
          }
          c.children.forEach(entry=>parseSection(entry, id))

        } else if (c.children) {
            // console.log(c)
            if (c.type == "CANVAS" && page==c.name) {
              // eslint-disable-next-line github/array-foreach
              c.children.forEach(check)
            }
        }
      }

      function parseSection(c, parent_id) {
        const parent = components[parent_id];
          const {name, id} = c
          // const {description = '', key} = data.components[c.id]
          const {width, height} = c.absoluteBoundingBox
          const filename = `${sanitize(name).toLowerCase()}.${options.format}`;
          let children = c.children?[]:null;
          if (c.children){
            c.children.forEach(entry=>children.push({name:entry.name, id:entry.id}))
          }
          parent.children.push({
            name,
            filename,
            id,
            // key,
            file: fileId,
            // description,
            children
          })
      }

      data.document.children.forEach(check)
      if (Object.values(components).length === 0) {
        throw Error('No section children found! check ' + page)
      }
      console.log(components)
      console.log(`${Object.values(components).length} sections found in the figma page`)
      return components
    })
    .then(components => {
      Object.values(components).forEach(entry=>{

          const childrenMap ={};
          entry.children.forEach(c=>childrenMap[c.id] = c)

          console.log('Getting export urls')
          return client.fileImages(
            fileId,
            {
              format: options.format,
              ids: Object.keys(childrenMap),
              scale: options.scale
            }
          ).then(({data}) => {
            for(const id of Object.keys(data.images)) {
              childrenMap[id].image = data.images[id]
            }
            entry.childrenMap = childrenMap
            return entry
          })
          .then(entry => {
            return ensureDir(join(outputDir))
              .then(() => writeFile(resolve(outputDir, `data.${entry.name}.${options.format}.json`), JSON.stringify(entry), 'utf8'))
              .then(() => entry)
          })
          .then(entry => {
            const contentTypes = {
              'svg': 'image/svg+xml',
              'png': 'image/png',
              'jpg': 'image/jpeg'
            }
            return queueTasks(Object.values(entry.childrenMap).map(item => () => {
              return got.get(item.image, {
                headers: {
                  'Content-Type': contentTypes[options.format]
                },
                encoding: (options.format === 'svg' ? 'utf8' : null)
              })
              .then(response => {
                return ensureDir(join(outputDir, entry.name, options.format))
                  .then(() =>entry.children.forEach(c=> ensureDir(join(outputDir, entry.name, c.name))))
                  .then(() => writeFile(join(outputDir + '/' + entry.name, options.format, item.filename), response.body, (options.format === 'svg' ? 'utf8' : 'binary')))
              })
            }))
          })
          .catch(error => {
            throw Error(`Error fetching entry from Figma: ${error}`)
          })

        })
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
