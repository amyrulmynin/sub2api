package schema

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBatchImageJobCurrencyDefaultsToMYR(t *testing.T) {
	for _, entField := range (BatchImageJob{}).Fields() {
		descriptor := entField.Descriptor()
		if descriptor.Name == "currency" {
			require.Equal(t, "MYR", descriptor.Default)
			return
		}
	}

	require.Fail(t, "missing currency field")
}
