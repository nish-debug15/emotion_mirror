const fs = require('fs');
const https = require('https');
const path = require('path');

const MODELS_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

const dir = path.join(__dirname, 'public/models');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

MODELS.forEach(file => {
  https.get(`${MODELS_URL}${file}`, response => {
    response.pipe(fs.createWriteStream(path.join(dir, file)));
    console.log(`Downloaded ${file}`);
  });
});