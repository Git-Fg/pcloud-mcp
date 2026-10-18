# pCloud docs: protocols/http_json_protocol/authentication.html

> Source: https://docs.pcloud.com/protocols/http_json_protocol/authentication.html

# HTTP / JSON protocol

## Authentication

On a single connection (i.e. keep-alive connection) you need to authenticate successfully just once. All requests after that will ignore any user credentials passed and will use the ones from the successful authentication.

More details about the authentication [here](/methods/intro/authentication.html).

Initially connections open to the server have quite low inactivity timeout. However once you authenticate over the connection the timeout will be quite long (over an hour).

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
