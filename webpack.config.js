var path = require('path');

module.exports = {
  entry: './app.js',
  target: 'node',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'recaster.js'
  }
}