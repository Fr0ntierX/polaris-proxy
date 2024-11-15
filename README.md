# Polaris Secure Proxy

The Polaris Secure Proxy is an HTTP proxy server that implements communication encryption proxy and private key management for [Polaris Secure Containers](https://www.fr0ntierx.com/polaris).

## Overview

The Polaris Secure Proxy is an essential part of a [Polaris Secure Container](https://www.fr0ntierx.com/). The Polaris Proxy is distributed commercially as part of the [Polaris Secure Container Products](https://www.fr0ntierx.com/polaris) on the Azure Marketplace and Google Cloud Marketplace. This repository makes all of the code and the full build pipeline available for inspection and verification.

### Encryption Proxy

It is an HTTP proxy that sits in front of an arbitrary applicaiton that communicates via HTTP. The proxy can be configured to encrypt and decrypt all HTTP requests and responses using an integrated encryption scheme (see [Polaris SDK](https://github.com/Fr0ntierX/polaris-sdk) for details).

### Trusted Execution Environments

The communication between the proxy and external services or devices is encrypted. The communication between the proxy and the configured workload is unencrypted as they are designed to be running inside of a Trusted Execution Environment (TEE) where the memory is encrypted.

### Key management

The proxy is also responsible for managing the private keys required for the encryption and decryption of the HTTP requests and responses. The proxy can be configured to use a variety of asymmetric key management strategies, including ephemeral keys, keys stored in Google Cloud KMS or keys stored in Azure Key Vault. Since the proxy is designed to be running inside of a TEE, the keys are always accessed through an attestation service that verifies the remote attesation created by the TEE, so the key is only allowed to be used inside of a secure TEE environment.

## Usage

You can find the official Docker image of the Polari Secure Proxy on DockerHub as [fr0ntierx/polaris-proxy](https://hub.docker.com/r/fr0ntierx/polaris-proxy). The only environment variable that is required is the URL of the workload the proxy is going to be forwarding requests to - `POLARIS_CONTAINER_WORKLOAD_BASE_URL`.

```bash
docker run -it -e POLARIS_CONTAINER_WORKLOAD_BASE_URL="http://localhost:3001" fr0ntierx/polaris-proxy
```

For a full description of all parameters, please refer to the [Polaris Documentation](https://docs.fr0ntierx.com/polaris-proxy).

## Examples

You can find examples of how the Polaris Secure Proxy can be used in the [examples](examples) directory.

### Public Cloud Providers Registries

Additionally, the image is available in the following public registries:

- Azure: `fr0ntierxpublic.azurecr.io/polaris-proxy`
- Google Cloud: `us-docker.pkg.dev/fr0ntierx-public/fr0ntierx-public-registry/polaris-proxy`

### Build pipeline

The Docker images are built and pushed to the public registries using the GitHub Actions CI/CD pipeline. You can inspect the full supply chain of the image in the [Actions section](https://github.com/Fr0ntierX/polaris-proxy/actions). This allows you to verify the integrity of the image and the build process.

### Local usage

If you want to experiment with the proxy locally, you can start the proxy locally by installing all dependendencies and running the server.

```bash
export POLARIS_CONTAINER_WORKLOAD_BASE_URL="http://localhost:3001"

yarn install

yarn dev
```

## About Polaris

Polaris Secure Containers enable the secure deployment of applications within a Trusted Execution Environment (TEE), encrypting all data in transit, and isolating sensitive information from the underlying infrastructure. To learn more about Polaris, please visit the [Polaris Secure Containers website](https://www.fr0ntierx.com/polaris).

## Documentation

You can find the full documentation for the Polaris Secure Proxy on the [Polaris Documentation](https://docs.fr0ntierx.com/polaris-proxy) website.

## Support

If you encounter any problmes please create an [Issue](https://github.com/Fr0ntierX/polaris-proxy/issues).

## License

The Polaris Secure Proxy is licensed under the [GNU AGPL v3](LICENSE) is not allowed to be used commercially unless you purchase a subscription to one of the Polaris Secure Container products on the Azure Marketplace or the Google Cloud Marketplace.
