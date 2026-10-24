/**
 * WebForge Builder — arranque local.
 */
const app = require('./src/webapp');
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`WebForge Builder ▶ http://localhost:${PORT}`));
