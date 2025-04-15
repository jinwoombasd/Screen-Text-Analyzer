import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { HfInference } from '@huggingface/inference';

// Anthropic SDK types
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

interface AnthropicClient {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      messages: AnthropicMessage[];
    }) => Promise<AnthropicResponse>;
  };
}

interface TextBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

interface TesseractBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: TesseractBBox;
}

interface TesseractLine {
  words: TesseractWord[];
  bbox: TesseractBBox;
}

interface TesseractResult {
  data: {
    text: string;
    lines: TesseractLine[];
  };
}

interface WorkerInstance {
  logger: (m: LoggerMessage) => void;
}

// Update TesseractWorker interface
type ImageLike = string | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

interface TesseractWorker {
  logger: (m: LoggerMessage) => void;
  loadLanguage: (lang: string) => Promise<void>;
  initialize: (lang: string) => Promise<void>;
  recognize: (image: ImageLike) => Promise<TesseractResult>;
  terminate: () => Promise<void>;
}

interface LoggerMessage {
  status: string;
  progress?: number;
}

type CleanedText = string;

const ScreenReader: React.FC = () => {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cleanedText, setCleanedText] = useState<CleanedText>('');
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<TesseractWorker | null>(null);
  const hf = useRef(new HfInference(process.env.REACT_APP_HUGGINGFACE_API_KEY));
  const [initializationStatus, setInitializationStatus] = useState<string>('Starting initialization...');
  const [initError, setInitError] = useState<string | null>(null);
  const [languages] = useState<string[]>(['eng', 'kor']);
  const isMounted = useRef(true);
  
  const initializeWorker = useCallback(async () => {
    try {
      console.log('Starting worker initialization...');
      const baseWorker = await createWorker();
      console.log('Base worker created successfully');
      const worker = baseWorker as unknown as TesseractWorker;
      workerRef.current = worker;
      
      // Set up logger
      worker.logger = (m: LoggerMessage) => {
        if (isMounted.current) {
          console.log('Tesseract Progress:', m);
          setInitializationStatus(m.status);
        }
      };

      // Initialize languages sequentially
      try {
        console.log('Starting language loading process...');
        setInitializationStatus('Loading languages...');
        for (const lang of languages) {
          if (!isMounted.current) break;
          console.log(`Loading language: ${lang}`);
          await worker.loadLanguage(lang);
          console.log(`Successfully loaded language: ${lang}`);
        }
        
        if (isMounted.current) {
          console.log('All languages loaded, initializing worker with languages:', languages);
          await worker.initialize([...languages].join('+'));
          console.log('Worker initialization completed successfully');
          setInitializationStatus('Ready');
        }
      } catch (error) {
        console.error('Language initialization error details:', error);
        throw new Error(`Language initialization failed: ${error}`);
      }
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Detailed worker initialization error:', error);
        setInitError(error?.message || 'Unknown initialization error');
        setInitializationStatus('Initialization failed');
        
        // Cleanup failed worker
        if (workerRef.current) {
          try {
            await workerRef.current.terminate();
            console.log('Failed worker terminated successfully');
          } catch (e) {
            console.error('Error terminating worker:', e);
          }
          workerRef.current = null;
        }
      }
    }
  }, [languages]);

  useEffect(() => {
    isMounted.current = true;
    initializeWorker();
    
    return () => {
      isMounted.current = false;
      if (workerRef.current) {
        workerRef.current.terminate().catch(console.error);
        workerRef.current = null;
      }
    };
  }, [initializeWorker]);

  const startCapture = async () => {
    if (initError) {
      console.error('Cannot start capture due to initialization error');
      return;
    }

    try {
      console.log('Requesting screen capture...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      setIsCapturing(true);
      console.log('Screen capture started');
      handleStream(stream);
    } catch (err) {
      console.error("Error capturing screen:", err);
      setIsCapturing(false);
    }
  };

  const cleanTextWithAI = async (text: string): Promise<string> => {
    try {
      setIsLoading(true);
      const response = await hf.current.textGeneration({
        model: 'gpt2',
        inputs: `Clean and format the following text, removing unnecessary elements and preserving the main content:\n\n${text}`,
        parameters: {
          max_length: 1000,
          temperature: 0.7,
          top_p: 0.9,
        }
      });

      if (response && response.generated_text) {
        return response.generated_text.trim();
      }
      return text;
    } catch (error) {
      console.error('Error cleaning text with AI:', error);
      return text;
    } finally {
      setIsLoading(false);
    }
  };

  const cleanTextLocally = (text: string): string => {
    // 1. Remove navigation elements and special characters
    let cleaned = text
      .replace(/^[=\-@®©]+/g, '')  // Remove special characters at start
      .replace(/Watch Live Sign In Home News Sport Business Innovation Culture Arts Travel Earth Audio Video Live/g, '')  // Remove navigation menu
      .replace(/Home\s+News\s+Sport\s+Business\s+Innovation\s+Culture\s+Arts\s+Travel\s+Earth\s+Audio\s+Video\s+Live/g, '')  // Remove BBC navigation
      .replace(/[^a-zA-Z0-9\s.,!?;:'"()\-$£]/g, ' ')  // Remove unusual characters but keep currency symbols
      .replace(/\s*\[\s*/g, ' ')   // Remove brackets
      .replace(/\s*\]\s*/g, ' ')
      .replace(/\s*\(\s*/g, '(')   // Fix parentheses spacing
      .replace(/\s*\)\s*/g, ') ')
      .replace(/["|"]/g, '"')      // Normalize quotes
      .replace(/['']/g, "'")       // Normalize apostrophes
      .trim();

    // 2. Split into sentences and process
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const processedSentences = sentences
      .map(sentence => sentence.trim())
      .filter(sentence => {
        // Remove very short sentences or fragments
        if (sentence.length < 5) return false;
        // Remove sentences that look like navigation or headers
        if (/^[A-Z\s]{1,5}$/g.test(sentence)) return false;
        // Remove sentences that are just numbers or special characters
        if (/^[^a-zA-Z]*$/g.test(sentence)) return false;
        return true;
      })
      .map(sentence => {
        return sentence
          .replace(/^[a-z]/, m => m.toUpperCase())  // Capitalize first letter
          .replace(/\s+/g, ' ')                     // Remove extra spaces
          .replace(/([a-zA-Z])'([a-zA-Z])/g, "$1'$2")  // Fix contractions
          .replace(/(\w+)([,.!?;:])/g, '$1$2')     // Remove spaces before punctuation
          .replace(/\s+([,.!?;:])/g, '$1')         // Remove spaces before punctuation
          .replace(/([,.!?;:])\s*/g, '$1 ')        // Add single space after punctuation
          .trim();
      });

    // 3. Group into paragraphs
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    processedSentences.forEach((sentence, index) => {
      // Skip empty sentences
      if (!sentence.trim()) return;

      // Start new paragraph if:
      const shouldStartNewParagraph = 
        // Current paragraph is getting long
        currentParagraph.length >= 3 ||
        // Current sentence looks like a quote
        /^["']/.test(sentence) ||
        // Current sentence is very short (likely a transition)
        sentence.length < 30 ||
        // Contains specific paragraph-breaking patterns
        /[:]\s*$/.test(sentence);

      if (shouldStartNewParagraph && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }

      currentParagraph.push(sentence);

      // Handle last sentence
      if (index === processedSentences.length - 1 && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
      }
    });

    // 4. Format final text with proper spacing
    return paragraphs
      .filter(p => p.trim().length > 0)  // Remove empty paragraphs
      .map(p => p.trim())               // Clean up paragraph edges
      .join('\n\n');                    // Add paragraph spacing
  };

  const filterAndFormatBlocks = (blocks: TextBlock[]): TextBlock[] => {
    // Filter out blocks with low confidence or suspicious patterns
    const processedBlocks = blocks
      .filter(block => {
        const text = block.text.trim();
        // Remove very short texts or texts that look like incomplete fragments
        if (text.length < 3) return false;
        // Remove texts that are just random characters or incomplete fragments
        if (/^[A-Z\s]{1,5}$/g.test(text)) return false;
        // Remove low confidence texts
        if (block.confidence < 0.6) return false;
        // Remove texts that are just special characters or numbers
        if (/^[^a-zA-Z]*$/g.test(text)) return false;
        // Remove navigation menu items
        if (/^(Home|News|Sport|Business|Innovation|Culture|Arts|Travel|Earth|Audio|Video|Live)$/i.test(text)) return false;
        return true;
      })
      .sort((a, b) => {
        if (Math.abs(a.bbox.y0 - b.bbox.y0) < 10) {
          return a.bbox.x0 - b.bbox.x0;
        }
        return a.bbox.y0 - b.bbox.y0;
      });

    // Combine all text and clean it locally
    const combinedText = processedBlocks
      .map(block => block.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (combinedText) {
      const cleanedText = cleanTextLocally(combinedText);
      setCleanedText(cleanedText);
    }

    return processedBlocks;
  };

  const analyzeFrame = async (video: HTMLVideoElement, context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    try {
      if (!workerRef.current) {
        throw new Error('Worker not initialized');
      }

      console.log('Analyzing single frame...');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      if (!imageData.data.some(val => val !== 0)) {
        console.log('Frame is empty');
        return;
      }

      console.log('Frame captured, starting text recognition...');
      
      const result = await workerRef.current.recognize(canvas);
      console.log('Recognition completed:', result);

      if (result?.data?.text && isMounted.current) {
        const blocks: TextBlock[] = [];
        
        if (result.data.lines && result.data.lines.length > 0) {
          result.data.lines.forEach(line => {
            if (line.words && line.words.length > 0) {
              line.words.forEach(word => {
                if (word.text.trim()) {
                  blocks.push({
                    text: word.text,
                    confidence: word.confidence / 100,
                    bbox: {
                      x0: word.bbox.x0,
                      y0: word.bbox.y0,
                      x1: word.bbox.x1,
                      y1: word.bbox.y1
                    }
                  });
                }
              });
            }
          });
        }

        if (blocks.length > 0 && isMounted.current) {
          console.log('Processing detected blocks:', blocks);
          const filteredBlocks = filterAndFormatBlocks(blocks);
          setBlocks(filteredBlocks);
        }
      }
    } catch (error) {
      console.error('Error analyzing frame:', error);
      setInitError(error instanceof Error ? error.message : 'Error analyzing frame');
    }
  };

  const analyzeFrames = (video: HTMLVideoElement, stream: MediaStream) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      console.error('Could not get canvas context');
      return;
    }

    // Analyze a single frame after a short delay
    setTimeout(async () => {
      setIsAnalyzing(true);
      await analyzeFrame(video, context, canvas);
      setIsAnalyzing(false);
      
      // Cleanup after analysis
      stream.getTracks().forEach(track => track.stop());
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      setIsCapturing(false);
    }, 1000); // Wait 1 second for video to stabilize
  };

  const handleStream = (stream: MediaStream) => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    
    // Add video preview
    video.style.position = 'fixed';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '320px';
    video.style.height = '240px';
    video.style.opacity = '0.3';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '9999';
    document.body.appendChild(video);
    
    video.onloadedmetadata = () => {
      console.log('Video ready:', {
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState
      });
      
      video.play().then(() => {
        console.log('Video playback started, beginning analysis...');
        analyzeFrames(video, stream);
      }).catch(error => {
        console.error('Error starting video:', error);
      });
    };
  };

  // Image preprocessing function for better OCR
  const enhanceImageForOCR = (imageData: ImageData): ImageData => {
    const data = imageData.data;
    
    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const adjusted = avg < 128 ? avg / 2 : Math.min(255, avg * 1.5);
      data[i] = adjusted;     // R
      data[i + 1] = adjusted; // G
      data[i + 2] = adjusted; // B
    }
    
    return imageData;
  };

  const stopCapture = () => {
    console.log('Stopping capture...');
    setIsCapturing(false);
  };

  return (
    <div className="screen-reader" style={{ 
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <h1 style={{
        color: '#2196f3',
        textAlign: 'center',
        marginBottom: '30px',
        fontSize: '32px',
        fontWeight: 'bold'
      }}>Screen Text Analyzer</h1>
      <div className="controls" style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '30px'
      }}>
        <button 
          onClick={isCapturing ? stopCapture : startCapture}
          className="capture-button"
          disabled={!workerRef.current || initializationStatus !== 'Ready'}
          style={{
            backgroundColor: isCapturing ? '#ff4444' : '#2196f3',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          {initializationStatus !== 'Ready' ? initializationStatus : 
           isCapturing ? "Stop Capture" : "Start Capture"}
        </button>
        {isAnalyzing && <span className="processing-indicator" style={{
          marginLeft: '15px',
          color: '#666',
          fontSize: '16px'
        }}>Processing...</span>}
      </div>
      {initError && (
        <div className="error-message" style={{
          color: '#ff4444',
          textAlign: 'center',
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#ffebee',
          borderRadius: '5px'
        }}>
          Error: {initError}
          <button onClick={initializeWorker} className="retry-button" style={{
            marginLeft: '10px',
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}>
            Retry Initialization
          </button>
        </div>
      )}
      <div className="text-display" style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '30px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h3 style={{
          color: '#333',
          marginBottom: '20px',
          fontSize: '20px',
          borderBottom: '2px solid #2196f3',
          paddingBottom: '10px'
        }}>Detected Text:</h3>
        
        {cleanedText ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div style={{
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#333',
              textAlign: 'justify',
              whiteSpace: 'pre-wrap'
            }}>
              {cleanedText}
            </div>
          </div>
        ) : (
          <p style={{
            textAlign: 'center',
            color: '#666',
            fontSize: '16px',
            padding: '20px 0'
          }}>No text detected yet</p>
        )}
      </div>
    </div>
  );
};

export default ScreenReader; 