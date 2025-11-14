const express = require('express');
const sharp = require('sharp');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { removeBackground } = require('@imgly/background-removal-node');

const app = express();
// NEW: Hostinger provides the port. This is the standard way to get it.
const port = process.env.PORT || 3000;

// Set up temp directory
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

app.use(cors());
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- NEW: Serve your app.html file and other static files ---
// This makes the server show your website
app.use(express.static(path.join(__dirname, '/')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});


// --- Image Optimizer Route (UPGRADED) ---
app.post('/optimize', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No image uploaded.');
  }

  const {
    format = 'webp',
    quality = 80,
    width,
    height,
    fit = 'inside',
    rotate,
    grayscale,
    flip,
    flop
  } = req.body;

  console.log('Optimizing with options:', req.body);

  try {
    let imageProcessor = sharp(req.file.buffer);

    // 1. Handle Resize
    const w = width ? parseInt(width) : null;
    const h = height ? parseInt(height) : null;
    if (w || h) {
      imageProcessor.resize({
        width: w,
        height: h,
        fit: fit,
        withoutEnlargement: true,
      });
    }

    // 2. Handle Rotate
    if (rotate && parseInt(rotate) !== 0) {
      imageProcessor.rotate(parseInt(rotate));
    }

    // 3. Handle Effects
    if (grayscale === 'true') imageProcessor.grayscale();
    if (flip === 'true') imageProcessor.flip();
    if (flop === 'true') imageProcessor.flop();

    // 4. Handle Format and Quality
    const q = parseInt(quality);
    if (format === 'jpeg') {
      imageProcessor.jpeg({ quality: q, progressive: true });
    } else if (format === 'webp') {
      imageProcessor.webp({ quality: q });
    } else if (format === 'png') {
      imageProcessor.png({ compressionLevel: Math.floor(q / 10), quality: q });
    } else if (format === 'avif') {
      imageProcessor.avif({ quality: q - 10 > 0 ? q - 10 : 1 });
    } else if (format === 'tiff') {
      imageProcessor.tiff({ quality: q });
    } else if (format === 'gif') {
      imageProcessor.gif();
    }

    const optimizedImageBuffer = await imageProcessor.toBuffer();
    res.setHeader('Content-Type', `image/${format}`);
    res.send(optimizedImageBuffer);

  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).send('Error processing image.');
  }
});

// --- Background Remover Route (Unchanged) ---
app.post('/remove-bg', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No image uploaded.');
  }
  console.log('Removing background at 100% quality...');
  try {
    const tempInputPath = path.join(tempDir, `temp_input_${Date.now()}`);
    fs.writeFileSync(tempInputPath, req.file.buffer);
    
    const config = { output: { quality: 1, format: 'image/png' } };
    const blob = await removeBackground(tempInputPath, config);
    const buffer = Buffer.from(await blob.arrayBuffer());

    fs.unlinkSync(tempInputPath);
    console.log('Background removal complete.');

    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('Error removing background:', err);
    res.status(500).send('Error removing background.');
  }
});


app.listen(port, () => {
  console.log(`Image Tool server (v6) listening on port ${port}`);
});