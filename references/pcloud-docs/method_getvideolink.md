# pCloud docs: methods/streaming/getvideolink.html

> Source: https://docs.pcloud.com/methods/streaming/getvideolink.html

## getvideolink

This method can't be used from web applications. Referrer is restricted to pcloud.com.

Name

getvideolink

Auth

yes

Description

Get a streaming link for video file Takes fileid (or path) of a video file and provides links (same way [getfilelink](/methods/streaming/getfilelink.html) does with hosts and path) from which the video can be streamed with lower bitrate (and/or resolution).\
\
The transcoded video will be in a FLV container with x264 video and mp3 audio, by default the video bitrate will be adapted to the connection speed in real time.\
\
By default the content servers will send appropriate content-type for FLV files, this can be overridden with either forcedownload or contenttype optional parameters.\
\
Optionally skipfilename works the same way as in [getfilelink](/methods/streaming/getfilelink.html).\
\
Transcoding specific optional parameters are:

|  |  |
|----|----|
| Parameter | Description |
| **abitrate** | int audio bit rate in kilobits, from 16 to 320 |
| **vbitrate** | int video bitrate in kilobits, from 16 to 4000 |
| **resolution** | string in pixels, from 64x64 to 1280x960, WIDTHxHEIGHT |
| **fixedbitrate** | bool if set, turns off adaptive streaming and the stream will be with a constant bitrate. |

The video bitrate is only the initial if adaptive straming is used.\
\
The default parameters (that should generally be OK for most cases) are:

- no change to video resolution (if you know your device resolution it might be a good idea to set resolution)
- initial video bitrate of 1000kbit/sec with adapting to connection speed
- 128kbit audio bitrate

Generated links, not the method itself accept the HTTP GET parameter start, that if present will skip that much seconds of the video.

URL

https://api.pcloud.com/getvideolink

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
| **maxspeed** | int limit the download speed |
| **skipfilename** | int include the name of the file in the generated link |
| **abitrate** | int audio bit rate in kilobits, from 16 to 320 |
| **vbitrate** | int video bitrate in kilobits, from 16 to 4000 |
| **resolution** | string in pixels, from 64x64 to 1280x960, WIDTHxHEIGHT |
| **fixedbitrate** | bool if set, turns off adaptive streaming and the stream will be with a constant bitrate. |

Output

On success it will return array hosts with servers that have the file. The first server is the one we consider best for current download.\
\
In path there will be a request you should send to server. You need to construct the URL yourself by concatenating http:// or https:// with one of the hosts (first one) and the path.

Example

{\
    "result": 0,\
    "expires": "Thu, 03 Oct 2013 01:17:11 +0000",\
    "path": "/hash/My video.mp4",\
    "hosts": \[\
        "c11.pcloud.com",\
        "c20.pcloud.com"\
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
