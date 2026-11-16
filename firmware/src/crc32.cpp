#include "crc32.h"

uint32_t crc32Update(uint32_t state, const uint8_t* data, size_t len) {
  for (size_t i = 0; i < len; ++i) {
    state ^= data[i];
    for (int bit = 0; bit < 8; ++bit) {
      state = (state >> 1) ^ (0xEDB88320u & (0u - (state & 1u)));
    }
  }
  return state;
}

uint32_t crc32(const uint8_t* data, size_t len) {
  return crc32Final(crc32Update(kCrc32Init, data, len));
}
