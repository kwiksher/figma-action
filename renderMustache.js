const options = {
  page:"Page 1",
  section:"Section 1",
  template: './template.section.md',
  outputDir: './dist',
}

const layersyml='./template.layers.yml'

for(const arg of process.argv.slice(2)) {
  const [param, value] = arg.split('=')
  console.log(param, value)
  if(options[param]) {
    options[param] = value
  }
}

const data = options.outputDir + "/" + options.page + "/data." + options.section + ".jpg.json"
const output = options.outputDir + "/" + options.page + "/output." + options.section + ".md"

const Mustache = require('mustache');
const fs = require('fs');

// Read the JSON file
const jsonData = JSON.parse(fs.readFileSync(data, 'utf8'));

console.log(jsonData)
jsonData.parent = jsonData.name
//
// For markdown output.Section.md
// Read the Markdown template
const template = fs.readFileSync(options.template, 'utf8');

// Render the Markdown template with the JSON data
const renderedMarkdown = Mustache.render(template, jsonData);

console.log(renderedMarkdown)
// Write the rendered Markdown to a file
fs.writeFileSync(output, renderedMarkdown, 'utf8');

// For layers.yml
// Read the Markdown template
const templateYml = fs.readFileSync(layersyml, 'utf8');
const outputYml = options.outputDir + "/" + options.page + "/" + options.section + "/layers.yml"

// Render the Markdown template with the JSON data
let renderedYml = Mustache.render(templateYml, jsonData);

renderedYml = renderedYml.replaceAll("&amp;", "&")

console.log(renderedYml)
// Write the rendered Markdown to a file
fs.writeFileSync(outputYml, renderedYml, 'utf8');