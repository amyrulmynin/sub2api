package handler

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGatewayUsageQuotaMetadataUsesMYR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	(&GatewayHandler{}).usageQuotaLimited(ctx, ctx, &service.APIKey{Quota: 10}, nil, nil, nil)

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, "MYR", body["unit"])
	require.Equal(t, "MYR", body["quota"].(map[string]any)["unit"])
}
