# AI Experiments

This folder contains the training and OCR experiments used for the parking number plate project.

## File Index

| File | Purpose |
| --- | --- |
| `public-data-yolov8-easyocr.ipynb` | Trains a YOLOv8 plate detector with public data and uses EasyOCR for plate reading. |
| `fine-tuned-self-captured-data-yolov8-easyocr.ipynb` | Fine-tunes the detector on self-captured data and runs the YOLOv8 + EasyOCR pipeline. |
| `own-data-yolov8-trocr-fuzzy-matching-colour-filters.ipynb` | Runs a more advanced plate-reading workflow with TrOCR, fuzzy matching, and color-based filters. |
| `own-data-finetuned-yolov8-trocr-production-cpu-optimized.py` | Production-oriented CPU-optimized script for the custom dataset and TrOCR pipeline. |

## Notes

- The filenames were normalized to lowercase, hyphen-separated names for easier GitHub browsing and sharing.
- No files under `data/` were changed.
