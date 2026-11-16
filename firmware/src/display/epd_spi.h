#pragma once

#include <Arduino.h>
#include <SPI.h>

#include <initializer_list>

// e-paper 컨트롤러에 SPI 로 명령과 데이터를 보내는 공통 처리.
// BUSY 가 LOW 일 때 동작 중인 컨트롤러(JD79xxx, Waveshare E6 등)용이다.
class EpdSpi {
 public:
  void begin();
  // 둘 다 BUSY 가 config::kBusyTimeoutMs 안에 풀리지 않으면 false 를 돌려준다.
  bool reset();
  bool waitWhileBusy();

  void command(uint8_t cmd);
  void command(uint8_t cmd, std::initializer_list<uint8_t> values);
  void data(uint8_t value);
  void data(const uint8_t* values, size_t len);

 private:
  void write(bool isData, const uint8_t* bytes, size_t len);

  SPISettings settings_{4000000, MSBFIRST, SPI_MODE0};
};
