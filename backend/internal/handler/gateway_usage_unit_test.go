package handler

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type gatewayUsageRateLimitRepo struct {
	service.APIKeyRepository
	data *service.APIKeyRateLimitData
}

func (r *gatewayUsageRateLimitRepo) GetRateLimitData(context.Context, int64) (*service.APIKeyRateLimitData, error) {
	return r.data, nil
}

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

func TestGatewayUsageRateLimitOnlyMetadataUsesMYR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	apiKeyService := service.NewAPIKeyService(
		&gatewayUsageRateLimitRepo{data: &service.APIKeyRateLimitData{}},
		nil, nil, nil, nil, nil, nil,
	)

	(&GatewayHandler{apiKeyService: apiKeyService}).usageQuotaLimited(
		ctx,
		ctx,
		&service.APIKey{ID: 1, RateLimit1d: 10},
		nil,
		nil,
		nil,
	)

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, "MYR", body["unit"])
	rateLimits := body["rate_limits"].([]any)
	require.Len(t, rateLimits, 1)
	require.Equal(t, "MYR", rateLimits[0].(map[string]any)["unit"])
}
