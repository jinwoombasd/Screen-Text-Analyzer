import React from 'react';
import './App.css';
import ScreenReader from './components/ScreenReader';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Screen Text Analyzer</h1>
        <div className="content-container">
          <ScreenReader />
        </div>
      </header>
    </div>
  );
}

export default App;
