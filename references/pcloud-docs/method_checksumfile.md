# pCloud docs: methods/file/checksumfile.html

> Source: https://docs.pcloud.com/methods/file/checksumfile.html

## checksumfile

Name

checksumfile

Auth

yes

Description

Calculate checksums of a given file

URL

https://api.pcloud.com/checksumfile

Required

|            |                                 |
|------------|---------------------------------|
| Parameter  | Description                     |
| **fileid** | int id of the checked file      |
| **path**   | string path to the checked file |

Note that fileid or path could be used at once

Output

Upon success returns [metadata](/structures/metadata.html). sha1 checksum is returned from both US and Europe API servers. md5 is returned only from US API servers, not added in Europe as it's quite old and has collions. sha256 is returned in Europe only.

Example

{\
    sha1: "ef2109a0b10ed2033f7ca11c0b62284c5e7fc860",\
    md5: "4d200fbf4f7b5ea6eb1877d50e3d6c12",\
    sha256: "eacef649ad0b96d2d9b80b6688a459e1a3421e9b9e8362202626da2068e278a4",\
    metadata: {\
        size: 73269,\
        parentfolderid: 0,\
        width: 900,\
        fileid: 1729212,\
        contenttype: "image/jpeg",\
        hash: 10681749967730528000,\
        id: "f1729212",\
        isfolder: false,\
        thumb: true,\
        name: "Simple image.jpg",\
        modified: "Wed, 02 Oct 2013 15:05:09 +0000",\
        isshared: false,\
        height: 600,\
        category: 1,\
        ismine: true,\
        created: "Wed, 02 Oct 2013 14:29:11 +0000",\
        icon: "image"\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
