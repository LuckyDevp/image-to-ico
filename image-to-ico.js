const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');
const toIco = require('to-ico');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getHtmlContent())}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle file selection
ipcMain.on('select-image', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'png', 'gif', 'bmp'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    event.reply('image-selected', result.filePaths[0]);
  }
});

// Handle conversion
ipcMain.on('convert-to-ico', async (event, imagePath) => {
  try {
    // Read the image
    const image = await Jimp.read(imagePath);
    
    // Resize to common icon sizes
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const resizedImages = await Promise.all(
      sizes.map(size => 
        image.clone().resize(size, size).getBufferAsync(Jimp.MIME_PNG)
      )
    );
    
    // Convert to ICO
    const icoBuffer = await toIco(resizedImages);
    
    // Ask user where to save the file
    const savePath = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Icon',
      defaultPath: path.join(app.getPath('downloads'), 'icon.ico'),
      filters: [
        { name: 'Icon', extensions: ['ico'] }
      ]
    });
    
    if (!savePath.canceled) {
      fs.writeFileSync(savePath.filePath, icoBuffer);
      event.reply('conversion-complete', savePath.filePath);
    }
  } catch (error) {
    event.reply('conversion-error', error.message);
  }
});

function getHtmlContent() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image to ICO Converter</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    body {
      background-color: #f5f5f5;
      color: #333;
      padding: 20px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      padding: 30px;
      text-align: center;
    }
    
    h1 {
      margin-bottom: 20px;
      color: #4a6cf7;
    }
    
    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 10px;
      padding: 40px;
      margin: 20px 0;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .upload-area:hover {
      border-color: #4a6cf7;
      background-color: #f9f9f9;
    }
    
    .upload-icon {
      font-size: 48px;
      margin-bottom: 10px;
      color: #4a6cf7;
    }
    
    .selected-image {
      max-width: 100%;
      max-height: 200px;
      margin: 20px 0;
      border-radius: 5px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    }
    
    .btn {
      background: linear-gradient(135deg, #4a6cf7, #7a5cf7);
      color: white;
      border: none;
      border-radius: 5px;
      padding: 12px 25px;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      margin: 10px 5px;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    
    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .status {
      margin-top: 20px;
      padding: 10px;
      border-radius: 5px;
    }
    
    .success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    
    .error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Image to ICO Converter</h1>
    <p>Select an image to convert to ICO format for your application icon</p>
    
    <div class="upload-area" id="uploadArea">
      <div class="upload-icon">📁</div>
      <p>Click to select an image file</p>
      <p><small>Supported formats: JPG, PNG, GIF, BMP</small></p>
    </div>
    
    <img id="previewImage" class="selected-image hidden" src="" alt="Selected image">
    
    <div>
      <button id="convertBtn" class="btn" disabled>Convert to ICO</button>
    </div>
    
    <div id="statusMessage" class="status hidden"></div>
  </div>

  <script>
    const { ipcRenderer } = require('electron');
    
    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const previewImage = document.getElementById('previewImage');
    const convertBtn = document.getElementById('convertBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Selected image path
    let selectedImagePath = null;
    
    // Handle upload area click
    uploadArea.addEventListener('click', () => {
      ipcRenderer.send('select-image');
    });
    
    // Handle image selection
    ipcRenderer.on('image-selected', (event, imagePath) => {
      selectedImagePath = imagePath;
      previewImage.src = imagePath;
      previewImage.classList.remove('hidden');
      convertBtn.disabled = false;
      
      // Clear any previous status
      statusMessage.classList.add('hidden');
      statusMessage.classList.remove('success', 'error');
    });
    
    // Handle convert button click
    convertBtn.addEventListener('click', () => {
      if (selectedImagePath) {
        convertBtn.disabled = true;
        convertBtn.textContent = 'Converting...';
        ipcRenderer.send('convert-to-ico', selectedImagePath);
      }
    });
    
    // Handle conversion complete
    ipcRenderer.on('conversion-complete', (event, savePath) => {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert to ICO';
      
      statusMessage.textContent = \`Icon successfully saved to: \${savePath}\`;
      statusMessage.classList.remove('hidden', 'error');
      statusMessage.classList.add('success');
    });
    
    // Handle conversion error
    ipcRenderer.on('conversion-error', (event, errorMessage) => {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert to ICO';
      
      statusMessage.textContent = \`Error: \${errorMessage}\`;
      statusMessage.classList.remove('hidden', 'success');
      statusMessage.classList.add('error');
    });
  </script>
</body>
</html>
  `;
}
