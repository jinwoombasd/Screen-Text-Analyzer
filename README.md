# Screen Text Analyzer

A React application that captures screen content and performs OCR (Optical Character Recognition) to extract text from the captured area. The application supports both English and Korean text recognition.

## Features

- Screen capture functionality
- Real-time text recognition using Tesseract.js
- Multi-language support (English and Korean)
- Automatic text cleaning and formatting
- Modern and responsive UI

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Setup

1. Clone the repository:
```bash
git clone [your-repository-url]
cd personalized-ai-reader
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
3. The application will automatically recognize and display the text from the selected area

## Technologies Used

- React
- TypeScript
- Tesseract.js for OCR
- Hugging Face for text processing

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
