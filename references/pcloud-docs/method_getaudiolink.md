# pCloud docs: methods/streaming/getaudiolink.html

> Source: https://docs.pcloud.com/methods/streaming/getaudiolink.html

## getaudiolink

This method can't be used from web applications. Referrer is restricted to pcloud.com.

Name

getaudiolink

Auth

yes

Description

Get a streaming link for audio file Takes fileid (or path) of an audio (or video) file and provides links from which audio can be streamed in mp3 format. (Same way [getfilelink](/methods/streaming/getfilelink.html) does with hosts and path)\
\
Optional parameters are abitrate, forcedownload and contenttype.\
\
The default bitrate is 192kbit.\
\
It can also be used to extract the audio track from a video.\
\

The link itself supports the start GET parameter. This method can be used to play FLAC and other new formats on devices that only support mp3 playback.

URL

https://api.pcloud.com/getaudiolink

Required

|            |                                 |
|------------|---------------------------------|
| Parameter  | Description                     |
| **fileid** | int ID of the renamed file      |
| **path**   | string Path to the renamed file |

Use fileid or path

Optional

|  |  |
|----|----|
| Parameter | Description |
| **forcedownload** | int Download with *Content-Type* = *application/octet-stream* |
| **contenttype** | string Set *Content-Type* |
| **abitrate** | int audio bit rate in kilobits, from 16 to 320 |

Output

On success it will return array hosts with servers that have the file. The first server is the one we consider best for current download.\
\
In path there will be a request you should send to server. You need to construct the URL yourself by concatenating http:// or https:// with one of the hosts (first one) and the path.

Example

{\
    result: 0,\
    expires: "Thu, 03 Oct 2013 01:23:12 +0000",\
    path: "/hash/My Audio.mp3",\
    hosts: \[\
        "c53.pcloud.com",\
        "c58.pcloud.com"\
    \]\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **1005** | Unknown content-type requested. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **2044** | Video links can only be generated for videos. |
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
