import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    project: 'SpaceNovaX V2 Final',
    version: '2.3.0'
  });
});

app.use(express.static(distPath));

app.use((req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Build not found. Run npm run build first.');
  }
});

app.listen(PORT, () => {
  console.log(`SpaceNovaX V2 Final running on port ${PORT}`);
});
