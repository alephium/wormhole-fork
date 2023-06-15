// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.28.1
// 	protoc        (unknown)
// source: spy/v1/spy.proto

package spyv1

import (
	v1 "github.com/alephium/wormhole-fork/node/pkg/proto/publicrpc/v1"
	_ "google.golang.org/genproto/googleapis/api/annotations"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

// A MessageFilter represents an exact match for an emitter.
type EmitterFilter struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	// Source chain
	ChainId v1.ChainID `protobuf:"varint,1,opt,name=chain_id,json=chainId,proto3,enum=publicrpc.v1.ChainID" json:"chain_id,omitempty"`
	// Hex-encoded (without leading 0x) emitter address.
	EmitterAddress string `protobuf:"bytes,2,opt,name=emitter_address,json=emitterAddress,proto3" json:"emitter_address,omitempty"`
}

func (x *EmitterFilter) Reset() {
	*x = EmitterFilter{}
	if protoimpl.UnsafeEnabled {
		mi := &file_spy_v1_spy_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *EmitterFilter) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*EmitterFilter) ProtoMessage() {}

func (x *EmitterFilter) ProtoReflect() protoreflect.Message {
	mi := &file_spy_v1_spy_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use EmitterFilter.ProtoReflect.Descriptor instead.
func (*EmitterFilter) Descriptor() ([]byte, []int) {
	return file_spy_v1_spy_proto_rawDescGZIP(), []int{0}
}

func (x *EmitterFilter) GetChainId() v1.ChainID {
	if x != nil {
		return x.ChainId
	}
	return v1.ChainID(0)
}

func (x *EmitterFilter) GetEmitterAddress() string {
	if x != nil {
		return x.EmitterAddress
	}
	return ""
}

type FilterEntry struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	// Types that are assignable to Filter:
	//
	//	*FilterEntry_EmitterFilter
	Filter isFilterEntry_Filter `protobuf_oneof:"filter"`
}

func (x *FilterEntry) Reset() {
	*x = FilterEntry{}
	if protoimpl.UnsafeEnabled {
		mi := &file_spy_v1_spy_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *FilterEntry) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*FilterEntry) ProtoMessage() {}

func (x *FilterEntry) ProtoReflect() protoreflect.Message {
	mi := &file_spy_v1_spy_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use FilterEntry.ProtoReflect.Descriptor instead.
func (*FilterEntry) Descriptor() ([]byte, []int) {
	return file_spy_v1_spy_proto_rawDescGZIP(), []int{1}
}

func (m *FilterEntry) GetFilter() isFilterEntry_Filter {
	if m != nil {
		return m.Filter
	}
	return nil
}

func (x *FilterEntry) GetEmitterFilter() *EmitterFilter {
	if x, ok := x.GetFilter().(*FilterEntry_EmitterFilter); ok {
		return x.EmitterFilter
	}
	return nil
}

type isFilterEntry_Filter interface {
	isFilterEntry_Filter()
}

type FilterEntry_EmitterFilter struct {
	EmitterFilter *EmitterFilter `protobuf:"bytes,1,opt,name=emitter_filter,json=emitterFilter,proto3,oneof"`
}

func (*FilterEntry_EmitterFilter) isFilterEntry_Filter() {}

type SubscribeSignedVAARequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	// List of filters to apply to the stream (OR).
	// If empty, all messages are streamed.
	Filters []*FilterEntry `protobuf:"bytes,1,rep,name=filters,proto3" json:"filters,omitempty"`
}

func (x *SubscribeSignedVAARequest) Reset() {
	*x = SubscribeSignedVAARequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_spy_v1_spy_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *SubscribeSignedVAARequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*SubscribeSignedVAARequest) ProtoMessage() {}

func (x *SubscribeSignedVAARequest) ProtoReflect() protoreflect.Message {
	mi := &file_spy_v1_spy_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use SubscribeSignedVAARequest.ProtoReflect.Descriptor instead.
func (*SubscribeSignedVAARequest) Descriptor() ([]byte, []int) {
	return file_spy_v1_spy_proto_rawDescGZIP(), []int{2}
}

func (x *SubscribeSignedVAARequest) GetFilters() []*FilterEntry {
	if x != nil {
		return x.Filters
	}
	return nil
}

type SubscribeSignedVAAResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	// Raw VAA bytes
	VaaBytes []byte `protobuf:"bytes,1,opt,name=vaa_bytes,json=vaaBytes,proto3" json:"vaa_bytes,omitempty"`
}

func (x *SubscribeSignedVAAResponse) Reset() {
	*x = SubscribeSignedVAAResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_spy_v1_spy_proto_msgTypes[3]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *SubscribeSignedVAAResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*SubscribeSignedVAAResponse) ProtoMessage() {}

func (x *SubscribeSignedVAAResponse) ProtoReflect() protoreflect.Message {
	mi := &file_spy_v1_spy_proto_msgTypes[3]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use SubscribeSignedVAAResponse.ProtoReflect.Descriptor instead.
func (*SubscribeSignedVAAResponse) Descriptor() ([]byte, []int) {
	return file_spy_v1_spy_proto_rawDescGZIP(), []int{3}
}

func (x *SubscribeSignedVAAResponse) GetVaaBytes() []byte {
	if x != nil {
		return x.VaaBytes
	}
	return nil
}

var File_spy_v1_spy_proto protoreflect.FileDescriptor

var file_spy_v1_spy_proto_rawDesc = []byte{
	0x0a, 0x10, 0x73, 0x70, 0x79, 0x2f, 0x76, 0x31, 0x2f, 0x73, 0x70, 0x79, 0x2e, 0x70, 0x72, 0x6f,
	0x74, 0x6f, 0x12, 0x06, 0x73, 0x70, 0x79, 0x2e, 0x76, 0x31, 0x1a, 0x1c, 0x67, 0x6f, 0x6f, 0x67,
	0x6c, 0x65, 0x2f, 0x61, 0x70, 0x69, 0x2f, 0x61, 0x6e, 0x6e, 0x6f, 0x74, 0x61, 0x74, 0x69, 0x6f,
	0x6e, 0x73, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x1a, 0x1c, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
	0x72, 0x70, 0x63, 0x2f, 0x76, 0x31, 0x2f, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63, 0x72, 0x70, 0x63,
	0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x22, 0x6a, 0x0a, 0x0d, 0x45, 0x6d, 0x69, 0x74, 0x74, 0x65,
	0x72, 0x46, 0x69, 0x6c, 0x74, 0x65, 0x72, 0x12, 0x30, 0x0a, 0x08, 0x63, 0x68, 0x61, 0x69, 0x6e,
	0x5f, 0x69, 0x64, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0e, 0x32, 0x15, 0x2e, 0x70, 0x75, 0x62, 0x6c,
	0x69, 0x63, 0x72, 0x70, 0x63, 0x2e, 0x76, 0x31, 0x2e, 0x43, 0x68, 0x61, 0x69, 0x6e, 0x49, 0x44,
	0x52, 0x07, 0x63, 0x68, 0x61, 0x69, 0x6e, 0x49, 0x64, 0x12, 0x27, 0x0a, 0x0f, 0x65, 0x6d, 0x69,
	0x74, 0x74, 0x65, 0x72, 0x5f, 0x61, 0x64, 0x64, 0x72, 0x65, 0x73, 0x73, 0x18, 0x02, 0x20, 0x01,
	0x28, 0x09, 0x52, 0x0e, 0x65, 0x6d, 0x69, 0x74, 0x74, 0x65, 0x72, 0x41, 0x64, 0x64, 0x72, 0x65,
	0x73, 0x73, 0x22, 0x57, 0x0a, 0x0b, 0x46, 0x69, 0x6c, 0x74, 0x65, 0x72, 0x45, 0x6e, 0x74, 0x72,
	0x79, 0x12, 0x3e, 0x0a, 0x0e, 0x65, 0x6d, 0x69, 0x74, 0x74, 0x65, 0x72, 0x5f, 0x66, 0x69, 0x6c,
	0x74, 0x65, 0x72, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0b, 0x32, 0x15, 0x2e, 0x73, 0x70, 0x79, 0x2e,
	0x76, 0x31, 0x2e, 0x45, 0x6d, 0x69, 0x74, 0x74, 0x65, 0x72, 0x46, 0x69, 0x6c, 0x74, 0x65, 0x72,
	0x48, 0x00, 0x52, 0x0d, 0x65, 0x6d, 0x69, 0x74, 0x74, 0x65, 0x72, 0x46, 0x69, 0x6c, 0x74, 0x65,
	0x72, 0x42, 0x08, 0x0a, 0x06, 0x66, 0x69, 0x6c, 0x74, 0x65, 0x72, 0x22, 0x4a, 0x0a, 0x19, 0x53,
	0x75, 0x62, 0x73, 0x63, 0x72, 0x69, 0x62, 0x65, 0x53, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x56, 0x41,
	0x41, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x2d, 0x0a, 0x07, 0x66, 0x69, 0x6c, 0x74,
	0x65, 0x72, 0x73, 0x18, 0x01, 0x20, 0x03, 0x28, 0x0b, 0x32, 0x13, 0x2e, 0x73, 0x70, 0x79, 0x2e,
	0x76, 0x31, 0x2e, 0x46, 0x69, 0x6c, 0x74, 0x65, 0x72, 0x45, 0x6e, 0x74, 0x72, 0x79, 0x52, 0x07,
	0x66, 0x69, 0x6c, 0x74, 0x65, 0x72, 0x73, 0x22, 0x39, 0x0a, 0x1a, 0x53, 0x75, 0x62, 0x73, 0x63,
	0x72, 0x69, 0x62, 0x65, 0x53, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x56, 0x41, 0x41, 0x52, 0x65, 0x73,
	0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x1b, 0x0a, 0x09, 0x76, 0x61, 0x61, 0x5f, 0x62, 0x79, 0x74,
	0x65, 0x73, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0c, 0x52, 0x08, 0x76, 0x61, 0x61, 0x42, 0x79, 0x74,
	0x65, 0x73, 0x32, 0x94, 0x01, 0x0a, 0x0d, 0x53, 0x70, 0x79, 0x52, 0x50, 0x43, 0x53, 0x65, 0x72,
	0x76, 0x69, 0x63, 0x65, 0x12, 0x82, 0x01, 0x0a, 0x12, 0x53, 0x75, 0x62, 0x73, 0x63, 0x72, 0x69,
	0x62, 0x65, 0x53, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x56, 0x41, 0x41, 0x12, 0x21, 0x2e, 0x73, 0x70,
	0x79, 0x2e, 0x76, 0x31, 0x2e, 0x53, 0x75, 0x62, 0x73, 0x63, 0x72, 0x69, 0x62, 0x65, 0x53, 0x69,
	0x67, 0x6e, 0x65, 0x64, 0x56, 0x41, 0x41, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x22,
	0x2e, 0x73, 0x70, 0x79, 0x2e, 0x76, 0x31, 0x2e, 0x53, 0x75, 0x62, 0x73, 0x63, 0x72, 0x69, 0x62,
	0x65, 0x53, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x56, 0x41, 0x41, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e,
	0x73, 0x65, 0x22, 0x23, 0x82, 0xd3, 0xe4, 0x93, 0x02, 0x1d, 0x22, 0x18, 0x2f, 0x76, 0x31, 0x3a,
	0x73, 0x75, 0x62, 0x73, 0x63, 0x72, 0x69, 0x62, 0x65, 0x5f, 0x73, 0x69, 0x67, 0x6e, 0x65, 0x64,
	0x5f, 0x76, 0x61, 0x61, 0x3a, 0x01, 0x2a, 0x30, 0x01, 0x42, 0x3f, 0x5a, 0x3d, 0x67, 0x69, 0x74,
	0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x61, 0x6c, 0x65, 0x70, 0x68, 0x69, 0x75, 0x6d,
	0x2f, 0x77, 0x6f, 0x72, 0x6d, 0x68, 0x6f, 0x6c, 0x65, 0x2d, 0x66, 0x6f, 0x72, 0x6b, 0x2f, 0x6e,
	0x6f, 0x64, 0x65, 0x2f, 0x70, 0x6b, 0x67, 0x2f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x2f, 0x73, 0x70,
	0x79, 0x2f, 0x76, 0x31, 0x3b, 0x73, 0x70, 0x79, 0x76, 0x31, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74,
	0x6f, 0x33,
}

var (
	file_spy_v1_spy_proto_rawDescOnce sync.Once
	file_spy_v1_spy_proto_rawDescData = file_spy_v1_spy_proto_rawDesc
)

func file_spy_v1_spy_proto_rawDescGZIP() []byte {
	file_spy_v1_spy_proto_rawDescOnce.Do(func() {
		file_spy_v1_spy_proto_rawDescData = protoimpl.X.CompressGZIP(file_spy_v1_spy_proto_rawDescData)
	})
	return file_spy_v1_spy_proto_rawDescData
}

var file_spy_v1_spy_proto_msgTypes = make([]protoimpl.MessageInfo, 4)
var file_spy_v1_spy_proto_goTypes = []interface{}{
	(*EmitterFilter)(nil),              // 0: spy.v1.EmitterFilter
	(*FilterEntry)(nil),                // 1: spy.v1.FilterEntry
	(*SubscribeSignedVAARequest)(nil),  // 2: spy.v1.SubscribeSignedVAARequest
	(*SubscribeSignedVAAResponse)(nil), // 3: spy.v1.SubscribeSignedVAAResponse
	(v1.ChainID)(0),                    // 4: publicrpc.v1.ChainID
}
var file_spy_v1_spy_proto_depIdxs = []int32{
	4, // 0: spy.v1.EmitterFilter.chain_id:type_name -> publicrpc.v1.ChainID
	0, // 1: spy.v1.FilterEntry.emitter_filter:type_name -> spy.v1.EmitterFilter
	1, // 2: spy.v1.SubscribeSignedVAARequest.filters:type_name -> spy.v1.FilterEntry
	2, // 3: spy.v1.SpyRPCService.SubscribeSignedVAA:input_type -> spy.v1.SubscribeSignedVAARequest
	3, // 4: spy.v1.SpyRPCService.SubscribeSignedVAA:output_type -> spy.v1.SubscribeSignedVAAResponse
	4, // [4:5] is the sub-list for method output_type
	3, // [3:4] is the sub-list for method input_type
	3, // [3:3] is the sub-list for extension type_name
	3, // [3:3] is the sub-list for extension extendee
	0, // [0:3] is the sub-list for field type_name
}

func init() { file_spy_v1_spy_proto_init() }
func file_spy_v1_spy_proto_init() {
	if File_spy_v1_spy_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_spy_v1_spy_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*EmitterFilter); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_spy_v1_spy_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*FilterEntry); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_spy_v1_spy_proto_msgTypes[2].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*SubscribeSignedVAARequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_spy_v1_spy_proto_msgTypes[3].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*SubscribeSignedVAAResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	file_spy_v1_spy_proto_msgTypes[1].OneofWrappers = []interface{}{
		(*FilterEntry_EmitterFilter)(nil),
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_spy_v1_spy_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   4,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_spy_v1_spy_proto_goTypes,
		DependencyIndexes: file_spy_v1_spy_proto_depIdxs,
		MessageInfos:      file_spy_v1_spy_proto_msgTypes,
	}.Build()
	File_spy_v1_spy_proto = out.File
	file_spy_v1_spy_proto_rawDesc = nil
	file_spy_v1_spy_proto_goTypes = nil
	file_spy_v1_spy_proto_depIdxs = nil
}
