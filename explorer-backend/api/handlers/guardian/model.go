package guardian

type GuardianSetDoc struct {
	ID        string   `bson:"_id" json:"id"`
	Addresses []string `bson:"addresses" json:"addresses"`
	Index     uint32   `bson:"index" json:"index"`
}
