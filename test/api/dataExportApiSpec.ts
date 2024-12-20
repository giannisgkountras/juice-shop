/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require("frisby");
import { expect } from "@jest/globals";
import config from "config";
import path from "path";

const fs = require("fs");

const jsonHeader = { "content-type": "application/json" };
const REST_URL = "http://localhost:3000/rest";

const getCaptchaAnswer = (token: string) => {
  return frisby
    .get(REST_URL + "/image-captcha", {
      headers: { Authorization: "Bearer " + token, "content-type": "application/json" }
    })
    .expect("status", 200)
    .expect("header", "content-type", /application\/json/)
    .then(({ json: captchaAnswer }) => captchaAnswer.answer);
};

describe("/rest/user/data-export", () => {
  it("Export data without use of CAPTCHA", () => {
    return frisby
      .post(REST_URL + "/user/login", {
        headers: jsonHeader,
        body: {
          email: "bjoern.kimminich@gmail.com",
          password: "bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI="
        }
      })
      .expect("status", 200)
      .then(({ json: jsonLogin }) => {
        return frisby
          .post(REST_URL + "/user/data-export", {
            headers: { Authorization: "Bearer " + jsonLogin.authentication.token, "content-type": "application/json" },
            body: {
              format: "1"
            }
          })
          .expect("status", 200)
          .expect("header", "content-type", /application\/json/)
          .expect("json", "confirmation", "Your data export will open in a new Browser window.")
          .then(({ json }) => {
            const parsedData = JSON.parse(json.userData);
            expect(parsedData.username).toBe("bkimminich");
            expect(parsedData.email).toBe("bjoern.kimminich@gmail.com");
          });
      });
  });

  it("Export data when CAPTCHA requested need right answer", () => {
    return frisby
      .post(REST_URL + "/user/login", {
        headers: jsonHeader,
        body: {
          email: "bjoern.kimminich@gmail.com",
          password: "bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI="
        }
      })
      .expect("status", 200)
      .then(({ json: jsonLogin }) => {
        return getCaptchaAnswer(jsonLogin.authentication.token).then((captchaAnswer) => {
          return frisby
            .post(REST_URL + "/user/data-export", {
              headers: {
                Authorization: "Bearer " + jsonLogin.authentication.token,
                "content-type": "application/json"
              },
              body: {
                answer: "AAAAAA",
                format: 1
              }
            })
            .expect("status", 401)
            .expect("bodyContains", "Wrong answer to CAPTCHA. Please try again.");
        });
      });
  });

  it("Export data using right answer to CAPTCHA", () => {
    return frisby
      .post(REST_URL + "/user/login", {
        headers: jsonHeader,
        body: {
          email: "bjoern.kimminich@gmail.com",
          password: "bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI="
        }
      })
      .expect("status", 200)
      .then(({ json: jsonLogin }) => {
        return getCaptchaAnswer(jsonLogin.authentication.token).then((captchaAnswer) => {
          return frisby
            .post(REST_URL + "/user/data-export", {
              headers: {
                Authorization: "Bearer " + jsonLogin.authentication.token,
                "content-type": "application/json"
              },
              body: {
                answer: captchaAnswer,
                format: 1
              }
            })
            .expect("status", 200)
            .expect("header", "content-type", /application\/json/)
            .expect("json", "confirmation", "Your data export will open in a new Browser window.")
            .then(({ json }) => {
              const parsedData = JSON.parse(json.userData);
              expect(parsedData.username).toBe("bkimminich");
              expect(parsedData.email).toBe("bjoern.kimminich@gmail.com");
            });
        });
      });
  });

  it("Export data including orders without use of CAPTCHA", () => {
    return frisby
      .post(REST_URL + "/user/login", {
        headers: jsonHeader,
        body: {
          email: "amy@" + config.get<string>("application.domain"),
          password: "K1f....................."
        }
      })
      .expect("status", 200)
      .then(({ json: jsonLogin }) => {
        return frisby
          .post(REST_URL + "/basket/4/checkout", {
            headers: { Authorization: "Bearer " + jsonLogin.authentication.token, "content-type": "application/json" }
          })
          .expect("status", 200)
          .then(() => {
            return frisby
              .post(REST_URL + "/user/data-export", {
                headers: {
                  Authorization: "Bearer " + jsonLogin.authentication.token,
                  "content-type": "application/json"
                },
                body: {
                  format: "1"
                }
              })
              .expect("status", 200)
              .expect("header", "content-type", /application\/json/)
              .expect("json", "confirmation", "Your data export will open in a new Browser window.")
              .then(({ json }) => {
                const parsedData = JSON.parse(json.userData);
                expect(parsedData.username).toBe("");
                expect(parsedData.email).toBe("amy@" + config.get<string>("application.domain"));
                expect(parsedData.orders[0].totalPrice).toBe(9.98);
                expect(parsedData.orders[0].bonus).toBe(0);
                expect(parsedData.orders[0].products[0].quantity).toBe(2);
                expect(parsedData.orders[0].products[0].name).toBe("Raspberry Juice (1000ml)");
                expect(parsedData.orders[0].products[0].price).toBe(4.99);
                expect(parsedData.orders[0].products[0].total).toBe(9.98);
                expect(parsedData.orders[0].products[0].bonus).toBe(0);
              });
          });
      });
  });

  it("Export data including reviews with use of CAPTCHA", () => {
    return frisby
      .post(REST_URL + "/user/login", {
        headers: jsonHeader,
        body: {
          email: "jim@" + config.get<string>("application.domain"),
          password: "ncc-1701"
        }
      })
      .expect("status", 200)
      .then(({ json: jsonLogin }) => {
        return getCaptchaAnswer(jsonLogin.authentication.token).then((captchaAnswer) => {
          return frisby
            .post(REST_URL + "/user/data-export", {
              headers: {
                Authorization: "Bearer " + jsonLogin.authentication.token,
                "content-type": "application/json"
              },
              body: {
                answer: captchaAnswer,
                format: 1
              }
            })
            .expect("status", 200)
            .expect("header", "content-type", /application\/json/)
            .expect("json", "confirmation", "Your data export will open in a new Browser window.")
            .then(({ json }) => {
              const parsedData = JSON.parse(json.userData);
              expect(parsedData.username).toBe("");
              expect(parsedData.email).toBe("jim@" + config.get<string>("application.domain"));
              expect(parsedData.reviews[0].message).toBe(
                "Looks so much better on my uniform than the boring Starfleet symbol."
              );
              expect(parsedData.reviews[0].author).toBe("jim@" + config.get<string>("application.domain"));
              expect(parsedData.reviews[0].productId).toBe(20);
              expect(parsedData.reviews[0].likesCount).toBe(0);
              expect(parsedData.reviews[0].likedBy[0]).toBe(undefined);
              expect(parsedData.reviews[1].message).toBe("Fresh out of a replicator.");
              expect(parsedData.reviews[1].author).toBe("jim@" + config.get<string>("application.domain"));
              expect(parsedData.reviews[1].productId).toBe(22);
              expect(parsedData.reviews[1].likesCount).toBe(0);
              expect(parsedData.reviews[1].likedBy[0]).toBe(undefined);
            });
        });
      });
  });
});
