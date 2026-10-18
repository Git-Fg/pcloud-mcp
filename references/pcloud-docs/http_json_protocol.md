# pCloud docs: protocols/http_json_protocol/index.html

> Source: https://docs.pcloud.com/protocols/http_json_protocol/index.html

# HTTP / JSON protocol

In the common cases ( e.g. web and mobile application development ) the most used method to access remote services, the used interface is HTTP/HTTPS. Such service is pCloud API.

## Requests

Method name is passed as request path (for example you should request /list to call list method).\
\
Parameters are passed by either GET, POST or using a cookie (and are set in this order, so that cookie with some name will overwrite the same GET parameter).

## Responses

Response is normally JSON array with multiple fields. The key result is always present.

### Successful response

result:0 means success.\
\
Successful response example:

\
{\
    result: 0,\
    \
    RESPONSE BODY\
    \
}\

### Error response

A non-zero result means an error.\
\
Then result is set to the error key and error is an error message. After every method definition we list the possible error codes that could be returned. When there is an error *HTTP header X-Error: xxxx* is sent with the error code.\
\
Error response example:

\
{\
    result: "error code",\
    error: "error message"\
}\

------------------------------------------------------------------------

### Pages

- [Authentication](/protocols/http_json_protocol/authentication.html)
- [Single Connection](/protocols/http_json_protocol/single_connection.html)
- [Uploading Files](/protocols/http_json_protocol/uploading_files.html)

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
