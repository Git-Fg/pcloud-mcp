# pCloud docs: methods/thumbnails/getthumblink.html

> Source: https://docs.pcloud.com/methods/thumbnails/getthumblink.html

## getthumblink

Name

getthumblink

Auth

yes

Description

Get a link to a thumbnail of a file\
\
Takes fileid (or path) as parameter and provides links from which a thumbnail of the file can be downloaded.\
\
Thumbnails can be created only from files whose [metadata](/structures/metadata.html) has thumb value set to true.\
\
The parameter size MUST be provided, in the format WIDTHxHEIGHT.\
\
The width MUST be between 16 and 2048, and divisible by either 4 or 5.\
\
The height MUST be between 16 and 1024, and divisible by either 4 or 5.\
\
By default the thumb will have the same aspect ratio as the original image, so the resulting thumbnail width or height (but not both) might be less than requested.\
\
If you want thumbnail exactly the size specified, you can set crop parameter. With crop, thumbnails will still have the right aspect ratio, but if needed some rows or cols (but not both) will be cropped from both sides. So if you have 1024x768 image and are trying to create 128x128 thumbnail, first the image will be converted to 768x768 by cutting 128 columns from both sides and then resized to 128x128. To create a rectangular thumb from 4:3 image exactly 1/8 is cropped from each side. By default the thumbnail is in jpeg format.\
\
If the type parameter is set to png, a png image will be produced.\
\
Thumbs are created on first request and cached for unspecified amount of time (or until file) changes.

Clients should attempt to cache thumbs if space permits.

It is also advisable to monitor the original file's hash to see if it has changed. If yes, a new thumbnail MUST be requested.

URL

https://api.pcloud.com/getthumblink

Required

|            |                                       |
|------------|---------------------------------------|
| Parameter  | Description                           |
| **fileid** | int id of the file for thumb          |
| **path**   | string filepath to the file for thumb |
| **size**   | string WIDTHxHEIGHT                   |

Use fileid or path

Optional

|           |                                                            |
|-----------|------------------------------------------------------------|
| Parameter | Description                                                |
| **crop**  | int If set, then the thumb will be cropped                 |
| **type**  | string If set to png, then the thumb will be in png format |

Output

On success the same data as with [getfilelink](/methods/streaming/getfilelink.html) is returned.\
\
Additionally the real image produced size is returned\
\
It will match reqested size if crop is specified or may differ otherwise.

Example

{\
    result: 0,\
    size: "32x32",\
    path: "/hash/My%20thumb.jpg",\
    expires: "Thu, 03 Oct 2013 01:06:49 +0000",\
    hosts: \[\
        "c63.pcloud.com",\
        "c1.pcloud.com"\
    \]\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **1014** | Thumb can not be created from this file type. |
| **1015** | Please provide valid thumb size. Width and height must be divisible either by 4 or 5 and must be between 16 and 2048 (1024 for height). |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **3001** | Could not create thumb from the given file. |
| **4000** | Too many login tries from this IP address. |
| **5002** | Internal error, no servers available. Try again later. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
