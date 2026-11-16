#pragma once

#include <stddef.h>
#include <stdint.h>

// CRC-32 (IEEE 802.3), zlib crc32 와 같은 결과.
uint32_t crc32(const uint8_t* data, size_t len);

// 나눠 받은 데이터를 이어서 계산할 때:
//   uint32_t state = kCrc32Init;
//   state = crc32Update(state, a, n);  ...
//   uint32_t crc = crc32Final(state);
constexpr uint32_t kCrc32Init = 0xFFFFFFFFu;
uint32_t crc32Update(uint32_t state, const uint8_t* data, size_t len);
inline uint32_t crc32Final(uint32_t state) { return ~state; }
