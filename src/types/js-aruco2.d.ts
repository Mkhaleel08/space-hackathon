declare module "js-aruco2" {
  export interface ArucoMarker {
    id: number;
    corners: Array<{ x: number; y: number }>;
    hammingDistance: number;
  }
  export interface ArucoDetector {
    detect(image: { width: number; height: number; data: Uint8ClampedArray }): ArucoMarker[];
  }
  export const AR: {
    Detector: new (config?: { dictionaryName?: string; maxHammingDistance?: number }) => ArucoDetector;
    Dictionary: new (name: string) => { codeList: string[]; generateSVG(id: number): string };
  };
}
declare module "js-aruco2/src/dictionaries/apriltag_36h11.js";
