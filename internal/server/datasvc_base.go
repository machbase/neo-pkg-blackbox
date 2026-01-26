package server

import (
	"context"
	"strconv"
	"sync"
)

type DataService struct {
	baseDir string
	dataDir string
	http    *MachbaseHttpClient

	mu          sync.RWMutex
	prefixCache map[string]string
	fpsCache    map[string]*int
}

func NewDataService(baseDir, dataDir string, httpc *MachbaseHttpClient) *DataService {
	return &DataService{
		baseDir:     baseDir,
		dataDir:     dataDir,
		http:        httpc,
		prefixCache: map[string]string{},
		fpsCache:    map[string]*int{},
	}
}

func (ds *DataService) resolvePrefix(ctx context.Context, camera string) (string, error) {
	ds.mu.RLock()
	if p, ok := ds.prefixCache[camera]; ok {
		ds.mu.RUnlock()
		if p == "" {
			return "chunk-stream", nil
		}
		return p, nil
	}
	ds.mu.RUnlock()

	if ds.http == nil || !ds.http.enabled {
		return "", newApiError(503, "Machbase HTTP client disabled")
	}

	meta, err := ds.metadata(ctx, camera)
	if err != nil {
		return "", err
	}

	var prefix string
	var fpsPtr *int

	if v, ok := meta["prefix"].(string); ok && v != "" {
		prefix = v
	}
	if raw, ok := meta["fps"]; ok {
		switch x := raw.(type) {
		case int:
			fps := x
			fpsPtr = &fps
		case int64:
			fps := int(x)
			fpsPtr = &fps
		case float64:
			fps := int(x)
			fpsPtr = &fps
		case string:
			if i, err := strconv.Atoi(x); err == nil {
				fps := i
				fpsPtr = &fps
			}
		}
	}

	ds.mu.Lock()
	ds.prefixCache[camera] = prefix
	ds.fpsCache[camera] = fpsPtr
	ds.mu.Unlock()

	if prefix == "" {
		return "chunk-stream", nil
	}
	return prefix, nil
}

func (ds *DataService) cameraFPS(ctx context.Context, camera string) (*int, error) {
	ds.mu.RLock()
	if fps, ok := ds.fpsCache[camera]; ok {
		ds.mu.RUnlock()
		return fps, nil
	}
	ds.mu.RUnlock()

	_, err := ds.resolvePrefix(ctx, camera)
	if err != nil {
		return nil, err
	}

	ds.mu.RLock()
	defer ds.mu.RUnlock()
	return ds.fpsCache[camera], nil
}
