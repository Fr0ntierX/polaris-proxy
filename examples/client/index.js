const axios = require("axios");
const {
  createAxiosRequestInterceptor,
  createAxiosResponseInterceptor,
  PolarisSDK,
  EphemeralKeyHandler,
} = require("@fr0ntier-x/polaris-sdk");

const requestUrl = process.env.REQUEST_URL;

const makeUnencryptedRequest = () => {
  console.log("Sending unencrypted request to:", requestUrl);

  axios
    .post(requestUrl, { data: "Test Unencrypted Communication" })
    .then((response) => {
      console.log("Response from server:", response.data);
    })
    .catch((error) => {
      console.error("Error from server:", error.message);
    });
};

const makeEncryptedRequest = () => {
  console.log("Sending encrypted request to:", requestUrl);

  const polarisSDK = new PolarisSDK(new EphemeralKeyHandler());

  axios.interceptors.request.use(createAxiosRequestInterceptor({ polarisSDK }));
  axios.interceptors.response.use(createAxiosResponseInterceptor({ polarisSDK }));

  axios
    .post(requestUrl, JSON.stringify({ data: "Test Unencrypted Communication" }), {
      headers: { "Content-Type": "application/json" },
    })
    .then((response) => {
      console.log("Response from server:", response.data.toString());
    })
    .catch((error) => {
      console.error("Error from server:", error.message);
    });
};

if (process.env.ENABLE_ENCRYPTED_COMMUNICATION) {
  makeEncryptedRequest();
  setInterval(makeEncryptedRequest, 5000);
} else {
  makeUnencryptedRequest();
  setInterval(makeUnencryptedRequest, 5000);
}
