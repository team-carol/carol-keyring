#include "transfer.h"

#include <string.h>

#include "crc32.h"

Transfer::Transfer(size_t frameBytes)
    : frameBytes_(frameBytes), buffer_(new uint8_t[frameBytes]) {}

TransferStatus Transfer::begin(uint32_t length, uint32_t crc) {
  if (state_ == TransferState::kRefreshing) return fail(TransferError::kBusy, 0);
  if (length != frameBytes_) return fail(TransferError::kBadLength, frameBytes_);

  expectedCrc_ = crc;
  received_ = 0;
  state_ = TransferState::kReceiving;
  return {state_, TransferError::kNone, received_};
}

TransferStatus Transfer::write(uint32_t offset, const uint8_t* data, size_t len) {
  if (state_ != TransferState::kReceiving) return fail(TransferError::kNotReceiving, 0);
  if (offset != received_) {
    // 수신 상태는 유지해서 웹이 기대 offset 부터 다시 보낼 수 있게 한다.
    return {TransferState::kError, TransferError::kBadOffset, received_};
  }
  if (len > frameBytes_ - received_) return fail(TransferError::kBadLength, frameBytes_);

  memcpy(buffer_.get() + offset, data, len);
  received_ += len;
  return {state_, TransferError::kNone, received_};
}

TransferStatus Transfer::commit() {
  if (state_ != TransferState::kReceiving) return fail(TransferError::kNotReceiving, 0);
  if (received_ != frameBytes_) return fail(TransferError::kIncomplete, received_);

  const uint32_t actual = crc32(buffer_.get(), frameBytes_);
  if (actual != expectedCrc_) return fail(TransferError::kCrcMismatch, actual);

  state_ = TransferState::kRefreshing;
  return {state_, TransferError::kNone, 0};
}

TransferStatus Transfer::abort() {
  if (state_ == TransferState::kRefreshing) return fail(TransferError::kBusy, 0);
  state_ = TransferState::kIdle;
  received_ = 0;
  return {state_, TransferError::kNone, 0};
}

TransferStatus Transfer::markDone() {
  state_ = TransferState::kDone;
  return {state_, TransferError::kNone, 0};
}

TransferStatus Transfer::markFailed(TransferError error, uint32_t value) {
  received_ = 0;
  state_ = TransferState::kIdle;
  return {TransferState::kError, error, value};
}

TransferStatus Transfer::fail(TransferError error, uint32_t value) {
  // 갱신 중에는 버퍼를 쓰고 있으므로 상태를 바꾸지 않는다.
  if (state_ != TransferState::kRefreshing) {
    state_ = TransferState::kIdle;
    received_ = 0;
  }
  return {TransferState::kError, error, value};
}
