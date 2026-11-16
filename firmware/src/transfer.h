#pragma once

#include <stddef.h>
#include <stdint.h>

#include <memory>

// docs/protocol.md 의 Status 값과 같아야 한다.
enum class TransferState : uint8_t {
  kIdle = 0,
  kReceiving = 1,
  kRefreshing = 2,
  kDone = 3,
  kError = 4,
  kRebooting = 5,  // 펌웨어 업데이트를 마치고 곧 재부팅한다
};

enum class TransferError : uint8_t {
  kNone = 0,
  kBadLength = 1,
  kBadOffset = 2,
  kCrcMismatch = 3,
  kNotReceiving = 4,
  kBusy = 5,
  kIncomplete = 6,
  kBadOpcode = 7,
  kPanelTimeout = 8,
  kFlash = 9,  // 펌웨어 업데이트 중 플래시/이미지 오류. value 는 esp_err_t
};

struct TransferStatus {
  TransferState state;
  TransferError error;
  uint32_t value;
};

// 한 프레임을 조각으로 받아 버퍼에 모으고 CRC 로 검증한다.
// begin/write/commit/abort 는 BLE 태스크에서, markDone/markFailed 는 화면 갱신 태스크에서 부른다.
// COMMIT 이 성공하면 상태가 REFRESHING 이 되고, 그동안 BLE 쪽은 상태와 버퍼를 바꾸지 않으므로
// 두 태스크가 버퍼를 동시에 건드리지 않는다.
class Transfer {
 public:
  explicit Transfer(size_t frameBytes);

  TransferStatus begin(uint32_t length, uint32_t crc);
  TransferStatus write(uint32_t offset, const uint8_t* data, size_t len);
  TransferStatus commit();
  TransferStatus abort();

  bool frameReady() const { return state_ == TransferState::kRefreshing; }
  const uint8_t* frame() const { return buffer_.get(); }
  // 화면 갱신이 끝나면 부른다.
  TransferStatus markDone();
  // 화면 갱신에 실패하면 부른다. 상태는 IDLE 로 돌아가 다음 BEGIN 을 받는다.
  TransferStatus markFailed(TransferError error, uint32_t value);

  TransferStatus status() const {
    const uint32_t value = state_ == TransferState::kReceiving ? received_ : 0;
    return {state_, TransferError::kNone, value};
  }

 private:
  TransferStatus fail(TransferError error, uint32_t value);

  const size_t frameBytes_;
  std::unique_ptr<uint8_t[]> buffer_;
  volatile TransferState state_ = TransferState::kIdle;
  uint32_t expectedCrc_ = 0;
  uint32_t received_ = 0;
};
