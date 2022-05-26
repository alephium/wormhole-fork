package initialize_db

import (
	"flag"
	"log"
)

// tableName is a const rather than an arg because using different BigTable instances
// will be more common than having multiple tables in a single instance.
// Table name is also passed to devnet guardians.
const tableName = "v2Events"

// These column family names match the guardian code that does the inserting.
var columnFamilies = []string{
	"MessagePublication",
	"QuorumState",
	"TokenTransferPayload",
	"AssetMetaPayload",
	"NFTTransferPayload",
	"TokenTransferDetails",
	"ChainDetails",
}

func main() {
	project := flag.String("project", "", "The Google Cloud Platform project ID. Required.")
	instance := flag.String("instance", "", "The Google Cloud Bigtable instance ID. Required.")
	keyFilePath := flag.String("keyFilePath", "", "The Google Cloud Service Account json key file path.")
	setupDB := flag.Bool("setupDB", false, "Run database setup - create table and column families.")

	flag.Parse()

	for _, f := range []string{"project", "instance", "keyFilePath"} {
		if flag.Lookup(f).Value.String() == "" {
			log.Fatalf("The %s flag is required.", f)
		}
	}

	if *setupDB {
		RunSetup(*project, *instance, *keyFilePath)
	}

}
