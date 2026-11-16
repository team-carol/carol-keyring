#include "epd_spi.h"

#include "config.h"

void EpdSpi::begin() {
  pinMode(config::kPinBusy, INPUT);
  pinMode(config::kPinRst, OUTPUT);
  pinMode(config::kPinDc, OUTPUT);
  pinMode(config::kPinCs, OUTPUT);
  digitalWrite(config::kPinCs, HIGH);
  digitalWrite(config::kPinDc, HIGH);
  SPI.begin(config::kPinSck, -1, config::kPinMosi, -1);
}

bool EpdSpi::reset() {
  digitalWrite(config::kPinRst, LOW);
  delay(20);
  digitalWrite(config::kPinRst, HIGH);
  delay(50);
  return waitWhileBusy();
}

bool EpdSpi::waitWhileBusy() {
  // 명령 직후에는 BUSY 가 바로 내려가지 않을 수 있어서 잠깐 기다린 뒤 확인한다.
  delay(10);
  const uint32_t started = millis();
  while (digitalRead(config::kPinBusy) == LOW) {
    if (millis() - started >= config::kBusyTimeoutMs) {
      Serial.printf("[epd] busy timeout after %lu ms\n",
                    static_cast<unsigned long>(config::kBusyTimeoutMs));
      return false;
    }
    delay(10);
  }
  delay(20);
  return true;
}

void EpdSpi::command(uint8_t cmd) { write(false, &cmd, 1); }

void EpdSpi::command(uint8_t cmd, std::initializer_list<uint8_t> values) {
  command(cmd);
  data(values.begin(), values.size());
}

void EpdSpi::data(uint8_t value) { write(true, &value, 1); }

void EpdSpi::data(const uint8_t* values, size_t len) { write(true, values, len); }

void EpdSpi::write(bool isData, const uint8_t* bytes, size_t len) {
  digitalWrite(config::kPinDc, isData ? HIGH : LOW);
  digitalWrite(config::kPinCs, LOW);
  SPI.beginTransaction(settings_);
  SPI.writeBytes(bytes, len);
  SPI.endTransaction();
  digitalWrite(config::kPinCs, HIGH);
}
