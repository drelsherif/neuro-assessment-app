import { useEffect, useState } from 'react';
import {
    FaceLandmarker,
    HandLandmarker,
    FilesetResolver,
    FaceLandmarkerResult,
    HandLandmarkerResult,
    NormalizedLandmark
} from '@mediapipe/tasks-vision';

// Define a type for the models we can create
export type MediaPipeModel = 'face' | 'hand';

const useMediaPipe = (modelType: MediaPipeModel) => {
    const [landmarker, setLandmarker] = useState<FaceLandmarker | HandLandmarker | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const createLandmarker = async () => {
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
                } else { // Default to face
                    newLandmarker = await FaceLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                            delegate: "GPU"
                        },
                        runningMode: "VIDEO",
                        numFaces: 1
                    });
                }
                setLandmarker(newLandmarker);
            } catch (e) {
                console.error("Error initializing MediaPipe Landmarker:", e);
            } finally {
                setIsLoading(false);
            }
        };

        createLandmarker();
    }, [modelType]);

    return { landmarker, isLoading };
};

export default useMediaPipe;

// We can keep drawing utilities here or move them to a dedicated file
// For now, let's keep them for simplicity
export const drawHandLandmarks = (
    ctx: CanvasRenderingContext2D,
    results: HandLandmarkerResult,
    canvasWidth: number,
    canvasHeight: number
) => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            // Here you can draw connectors and points
            landmarks.forEach(landmark => {
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