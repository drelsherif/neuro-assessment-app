import { useEffect, useState } from 'react';
import {
    FaceLandmarker,
    HandLandmarker,
    FilesetResolver,
    FaceLandmarkerResult,
    HandLandmarkerResult
    // NormalizedLandmark is not directly used in this file if only drawing functions use it
} from '@mediapipe/tasks-vision';

export type MediaPipeModel = 'face' | 'hand';

const useMediaPipe = (modelType: MediaPipeModel) => {
    const [landmarker, setLandmarker] = useState<FaceLandmarker | HandLandmarker | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const createLandmarker = async () => {
            setIsLoading(true); // Ensure loading state is true at the start
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );
                let newLandmarker: FaceLandmarker | HandLandmarker;
                if (modelType === 'hand') {
                    newLandmarker = await HandLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                            delegate: "GPU"
                        },
                        runningMode: "VIDEO",
                        numHands: 2
                    });
                } else { // 'face'
                    newLandmarker = await FaceLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                            delegate: "GPU"
                        },
                        runningMode: "VIDEO",
                        numFaces: 1,
                        outputFaceBlendshapes: true, // Important for some analyses
                        outputFacialTransformationMatrixes: true, // Important for some analyses
                    });
                }
                setLandmarker(newLandmarker);
            } catch (e) {
                console.error(`Error initializing MediaPipe ${modelType} Landmarker:`, e);
            } finally {
                setIsLoading(false);
            }
        };
        createLandmarker();
    }, [modelType]);

    return { landmarker, isLoading };
};

export default useMediaPipe;

export const drawFaceLandmarks = (
    ctx: CanvasRenderingContext2D,
    results: FaceLandmarkerResult,
    canvasWidth: number,
    canvasHeight: number
) => {
    // No clearRect here, as EyeTrackingTest clears its own canvas before drawing target & landmarks
    if (results.faceLandmarks) {
        results.faceLandmarks.forEach(landmarks => { // landmarks is an array of NormalizedLandmark
            landmarks.forEach(landmark => { // landmark is a single NormalizedLandmark
                const x = landmark.x * canvasWidth;
                const y = landmark.y * canvasHeight;
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, 2 * Math.PI); // Slightly larger dots
                ctx.fillStyle = 'aqua';
                ctx.fill();
            });
        });
    }
};

export const drawHandLandmarks = (
    ctx: CanvasRenderingContext2D,
    results: HandLandmarkerResult,
    canvasWidth: number,
    canvasHeight: number
) => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear canvas for hand tracking
    if (results.landmarks) { // results.landmarks is an array of hand landmarks (each hand is an array of NormalizedLandmark)
        for (const landmarks of results.landmarks) { // landmarks is for a single hand
            landmarks.forEach(landmark => { // landmark is a single NormalizedLandmark
                const x = landmark.x * canvasWidth;
                const y = landmark.y * canvasHeight;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = 'indigo';
                ctx.fill();
            });
        }
    }
};