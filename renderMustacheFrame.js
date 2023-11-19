const options = {
  frame:"Frame 1",
  template: './png.template.md',
  outputDir: './build',
}
for(const arg of process.argv.slice(3)) {
  const [param, value] = arg.split('=')
  console.log(param, value)
  if(options[param]) {
    options[param] = value
  }
}

const data = options.outputDir + "/" + options.frame + "/data.png.json"
const output = options.outputDir + "/" + options.frame + "/output.png.md"

const Mustache = require('mustache');
const fs = require('fs');

// Read the JSON file
const jsonData = JSON.parse(fs.readFileSync(data, 'utf8'));

console.log(jsonData)
// jsonData.parent = jsonData.name

// Read the Markdown template
const template = fs.readFileSync(options.template, 'utf8');

// Render the Markdown template with the JSON data
const renderedMarkdown = Mustache.render(template, {name:options.frame, data:jsonData});

console.log(renderedMarkdown)
// Write the rendered Markdown to a file
fs.writeFileSync(output, renderedMarkdown, 'utf8');