{{#.}}
# {{name}}
|  1st layer | Image | Id| 2nd layer |Id|
| --- | --- | --- | --- |----|
{{#children}}
| {{name}}  | <img src='./{{parent}}/jpg/{{filename}}'> | {{id}} | ||
{{#children}}
|           |                                           |         | {{name}} |{{id}} |
{{/children}}
{{/children}}
{{/.}}