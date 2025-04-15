# Screen Text Analyzer

A React application that captures screen content and performs OCR (Optical Character Recognition) to extract text from the captured area. The application supports both English and Korean text recognition, making it perfect for multilingual content extraction.

## Features

- 📸 Screen capture functionality
- 🔍 Real-time text recognition using Tesseract.js
- 🌏 Multi-language support (English and Korean)
- ✨ Automatic text cleaning and formatting
- 🎨 Modern and responsive UI
- 🧹 Automatic removal of navigation elements and irrelevant content
- 📝 Smart paragraph organization

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with screen capture support

## Setup

1. Clone the repository:
```bash
git clone https://github.com/jinwoombasd/Screen-Text-Analyzer.git
cd Screen-Text-Analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your API keys:
```
REACT_APP_HUGGINGFACE_API_KEY=your_huggingface_api_key
```

4. Start the development server:
```bash
npm start
```

## Usage

1. Click the "Start Capture" button
2. Select the area of the screen you want to analyze
3. Wait for the text recognition process to complete
4. View the extracted and formatted text in the application

The application will automatically:
- Remove navigation menus and irrelevant content
- Clean and format the extracted text
- Organize text into proper paragraphs
- Handle both English and Korean text

## Technologies Used

- React with TypeScript for robust frontend development
- Tesseract.js for accurate OCR capabilities
- Hugging Face for advanced text processing (optional)
- Modern CSS for responsive design

## Development

The project structure is organized as follows:

```
src/
  ├── components/
  │   ├── ScreenReader.tsx    # Main component for text recognition
  │   └── ScreenReader.css    # Styles for the component
  ├── App.tsx                 # Application entry point
  └── index.tsx              # React entry point
```

## License

MIT License - feel free to use this project for your own purposes.

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Author

Jinwoo Park (jinwoombasd@gmail.com)
