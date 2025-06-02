import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawFaceLandmarks } from '../../hooks/useMediaPipe';
import { calculateGazePosition } from '../../utils/testCalculations';
import { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

interface GazeDataPoint { /* ...interface content... */ }
interface GazeTestResults { /* ...interface content... */ }

const EyeTrackingTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('face');
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [gazeHistory, setGazeHistory] = useState<GazeDataPoint[]>([]);
    const [testResults, setTestResults] = useState<GazeTestResults | null>(null);
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [targetPosition, setTargetPosition] = useState({ x: 0.5, y: 0.5 });

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    const enableWebcam = async () => { /* ...same function... */ };
    const predictWebcam = useCallback(() => { /* ...same function... */ }, [landmarker, isTestRunning, targetPosition]);
    const handleStartTest = () => { /* ...same function... */ };
    const handleStopTest = () => { /* ...same function... */ };

    useEffect(() => { /* ...same animation effect... */ }, [isTestRunning]);
    useEffect(() => {
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            {/* FIX: This container controls the size and positioning */}
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        objectFit: 'cover', // Ensures video fills the container
                        transform: 'scaleX(-1)' // Flips to mirror mode
                    }}
                />
                <canvas
                    ref={canvasRef}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        zIndex: 1,
                        transform: 'scaleX(-1)' // Flips to match the video
                    }}
                />
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>
                    <h3>Eye Tracking Test</h3>
                    {isLoading && <p>Loading Model...</p>}
                    {!isWebcamEnabled && <button onClick={enableWebcam} disabled={isLoading}>Enable Webcam</button>}
                    {isWebcamEnabled && (
                        <>
                            <button onClick={handleStartTest} disabled={isTestRunning}>Start Test</button>
                            <button onClick={handleStopTest} disabled={!isTestRunning}>Stop Test</button>
                        </>
                    )}
                </div>
            </div>
            {testResults && <ResultsVisualization title="Eye Tracking Results" data={testResults} />}
        </div>
    );
};

export default EyeTrackingTest;