{{#.}}
# {{name}}
|  first chidlren | Image | Id| second chidlren |Id|
| --- | --- | --- | --- |----|
{{#children}}
| {{name}}  | <img src='./{{parent}}/jpg/{{filename}}'> | {{id}} | ||
{{#children}}
|           |                                           |         | {{name}} |{{id}} |
{{/children}}
{{/children}}
{{/.}}