# pCloud docs: methods/general/currentserver.html

> Source: https://docs.pcloud.com/methods/general/currentserver.html

## currentserver

Name

currentserver

Auth

no

Description

returns ip and hostname of the server you are currently connected to. The hostname is guaranteed to resolve only to the IP address(es) pointing to the same server. This call is useful when you need to track the upload progress.

URL

https://api.pcloud.com/currentserver

Output

|              |                                     |
|--------------|-------------------------------------|
| Parameters   | Description                         |
| **ip**       | string IP v.4 address of the server |
| **ipbin**    | strimg IP v.4 address               |
| **ipv6**     | string IP v.6 address of the server |
| **hostname** | string hostname of the server       |

Example

{\
    ipv6: "::1",\
    hostname: "api7.pcloud.com",\
    ip: "204.155.155.21",\
    result: 0,\
    ipbin: "204.155.155.60"\
}\

### Errors

|          |                                            |
|----------|--------------------------------------------|
| Code     | Description                                |
| **1000** | Log in required.                           |
| **2000** | Log in failed.                             |
| **4000** | Too many login tries from this IP address. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
