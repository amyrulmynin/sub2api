package migrate

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGeneratedBatchImageCurrencyDefaultsToMYR(t *testing.T) {
	for _, column := range BatchImageJobsColumns {
		if column.Name == "currency" {
			require.Equal(t, "MYR", column.Default)
			return
		}
	}

	require.Fail(t, "missing currency column")
}
