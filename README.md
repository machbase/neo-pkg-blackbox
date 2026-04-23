# neo-pkg-blackbox
## Overview

This is a backend server that integrates CCTV video recording, AI object detection, and event rule evaluation into a single system. It stores video chunks and detection data in Machbase (a time-series database) and provides access via REST APIs.

## Key Features

- **Camera Management**  
  Register RTSP/WebRTC cameras, enable/disable them, and check their status  

- **Video Recording**  
  Record RTSP streams using FFmpeg and store them in the database as chunk units  

- **Media Server**  
  Manage RTSP streams via MediaMTX  

- **AI Detection**  
  Collect object detection results by integrating with blackbox-ai-manager  

- **Event Rules**  
  Evaluate DSL-based rules (e.g., `person > 5 AND car >= 2`)  

- **Sensor Data**  
  Store and query sensor data  

- **Web UI**  
  Built-in web page for API testing  
