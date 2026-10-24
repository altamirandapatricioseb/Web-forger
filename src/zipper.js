/** Empaqueta el Map de archivos generados en un ZIP y lo streamea a la respuesta. */
const archiver = require('archiver');

function streamZip(files, rootName, res) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);
  for (const [path, content] of files) {
    archive.append(content, { name: `${rootName}/${path}` });
  }
  archive.finalize();
}

module.exports = { streamZip };
