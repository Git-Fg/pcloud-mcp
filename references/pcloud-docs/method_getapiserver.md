# pCloud docs: methods/general/getapiserver.html

> Source: https://docs.pcloud.com/methods/general/getapiserver.html

## getapiserver

Name

getapiserver

Auth

No

Description

This method returns closest API server to the requesting client. The biggest speed gain will be with upload methods. Clients should have fallback logic. If request to API server different from api.pcloud.com fails (network error) the client should fallback to using api.pcloud.com.

URL

https://api.pcloud.com/getapiserver

Output

binapi - array with API servers that support connections via pCloud's binary protocol\
\
api - array with API servers that support connections via HTTP/HTTPS protocol

Example

{\
  "result": 0,\
  "binapi": \[\
    "binapi-ams1.pcloud.com"\
  \],\
  "api": \[\
    "api-ams1.pcloud.com"\
  \]\
}\

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
