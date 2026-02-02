package server

import (
	"blackbox-backend/internal/config"
	"blackbox-backend/internal/db"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func doGet(t *testing.T, c *http.Client, baseURL, path string, q url.Values) (int, []byte) {
	t.Helper()

	u, err := url.Parse(baseURL + path)
	require.NoError(t, err)
	if q != nil {
		q.Set("rowsArray", "true")
		u.RawQuery = q.Encode()
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	resp, err := c.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return resp.StatusCode, b
}

func setupTestServer(t *testing.T) (*httptest.Server, *http.Client) {
	t.Helper()

	cfg, err := config.Load("../config/test.yaml")
	require.NoError(t, err)

	machbase, err := db.NewMachbase(cfg.Machbase)
	require.NoError(t, err)

	svr, err := New(cfg.Server, machbase)
	require.NoError(t, err)

	server := httptest.NewServer(svr)
	t.Cleanup(server.Close)

	client := server.Client()
	client.Timeout = 4 * time.Second

	return server, client
}

func TestAPI_GetCameras(t *testing.T) {
	server, client := setupTestServer(t)

	code, body := doGet(t, client, server.URL, "/api/cameras", nil)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body: %s", string(body))
}

func TestAPI_GetTimeRange(t *testing.T) {
	server, client := setupTestServer(t)

	q := url.Values{}
	q.Set("tagname", "camera-0")

	code, body := doGet(t, client, server.URL, "/api/get_time_range", q)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body: %s", string(body))
}

func TestAPI_GetSensors(t *testing.T) {
	server, client := setupTestServer(t)

	q := url.Values{}
	q.Set("tagname", "camera-0")

	code, body := doGet(t, client, server.URL, "/api/sensors", q)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body: %s", string(body))
}

func TestAPI_GetSensorData(t *testing.T) {
	server, client := setupTestServer(t)

	q := url.Values{}
	q.Set("tagname", "camera-0")
	q.Set("sensors", "sensor-1")
	q.Set("start", "2025-10-21T19:28:07.1234")
	q.Set("end", "2025-10-21T19:28:09.1234")

	code, body := doGet(t, client, server.URL, "/api/sensor_data", q)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body: %s", string(body))
}

func TestAPI_GetChunkInfo(t *testing.T) {
	server, client := setupTestServer(t)

	q := url.Values{}
	q.Set("tagname", "camera-0")
	q.Set("time", "2025-10-21T19:29:01.628667")

	code, body := doGet(t, client, server.URL, "/api/get_chunk_info", q)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body: %s", string(body))
}

func TestAPI_GetVideoChunk(t *testing.T) {
	server, client := setupTestServer(t)

	q := url.Values{}
	q.Set("tagname", "camera-0")
	q.Set("time", "2025-10-21T19:29:01.628667")

	code, body := doGet(t, client, server.URL, "/api/v_get_chunk", q)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body length: %d bytes", len(body))
}

func TestAPI_GetCameraRollupInfo(t *testing.T) {
	server, client := setupTestServer(t)

	q := url.Values{}
	q.Set("tagname", "camera-0")
	q.Set("minutes", "1")
	q.Set("start_time", "1761094496000000000")
	q.Set("end_time", "1761097487652444000")

	code, body := doGet(t, client, server.URL, "/api/get_camera_rollup_info", q)
	require.Equal(t, http.StatusOK, code, string(body))

	t.Logf("body: %s", string(body))
}
