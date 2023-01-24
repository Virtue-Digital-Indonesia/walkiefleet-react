import { useState, useEffect, useRef } from "react";
import alawmulaw from "./alawmulau";
import SoundBuffer from "./SoundBuffer";

const Home = () => {
  let sampleRate;

  let udpPacketBuffer;
  let currentFrame;
  let currentBufferIndex = 0;
  let bufferSamplesCount = 0;
  let sequenceNumber = 0;
  let ssrc = 0;

  const wsRef = useRef()
  const audioContextRef = useRef()
  const microphoneStreamRef = useRef()
  const audioProcessorNodeRef = useRef()
  const soundBufferRef = useRef()
  const pttButtonRef = useRef()
  // active call id
  const activeCallIdRef = useRef('')
  // is transmit (you on input voice)
  const isTransmitRef = useRef(false)
  // is receive (you on receive output voice)
  const isReceiveRef = useRef(false)
  
  // is On Call
  const [isOnCall, setIsOnCall] = useState(false)
  // selectedObjectId = ID
  const [selectedObjectId, setSelectedObjectId] = useState('')
  // selectedUserId = UserID
  const [selectedUserId, setSelectedUserId] = useState('')
  // selectedObjectName = Name
  const [selectedObjectName, setSelectedObjectName] = useState('')
  // object type group/private
  const [selectedObjectType, setSelectedObjectType] = useState('')
  // call id
  const [activeCallId, setActiveCallId] = useState('')
  // data
  const [listUsers, setListUsers] = useState([])
  const [listGroups, setListGroups] = useState([])

  const runWebsocket = () => {
    if ("WebSocket" in window) {
      // SHOULD BE WS
      wsRef.current = new WebSocket("ws://" + sessionStorage.getItem("serverAddress"));

      wsRef.current.onopen = function () {};

      wsRef.current.onmessage = function (evt) {
        let messages = JSON.parse(evt.data);
        for (let i = 0; i < messages.length; i++) {
          let msg = messages[i];
          switch (msg.MessageID) {
            case "SERVER_CONFIG":
              sessionStorage.setItem("VoipPort", msg.VoipPort);
              sessionStorage.setItem("AudioSampleRate", msg.AudioSampleRate);
              sessionStorage.setItem("AudioBitRate", msg.AudioBitRate);
              sessionStorage.setItem("AudioFrameSize", msg.AudioFrameSize);

              bufferSamplesCount =
                (sessionStorage.getItem("AudioSampleRate") / 1000) *
                sessionStorage.getItem("AudioFrameSize");
              udpPacketBuffer = new ArrayBuffer(12 + bufferSamplesCount); // aLaw, muLaw

              currentFrame = new Int16Array(bufferSamplesCount);
              currentBufferIndex = 0;

              //VoipEndpoint = new IPEndPoint(ServerIPAddr, VoIPPort);
              //rtpPacket = new RtpPacket { Version = 2, SSRC = ssrc, PayloadType = 106, SequenceNumber = 0, Timestamp = 0 };
              ssrc = new Uint32Array(1);
              window.crypto.getRandomValues(ssrc);
              let devconf = [
                {
                  MessageID: "DEVICE_CONFIG",
                  Ssrc: ssrc[0],
                  AppName: "ApiClientWEB",
                  VersionName: "5.5",
                  VersionCode: 1,
                  AudioCodec: 1,
                  VoiceOverTcp: true,
                  Password: sessionStorage.getItem("password"),
                  DeviceData: {
                    SessionID: getBase64ID(),
                    ID: getDeviceID(),
                    DeviceDescription:
                      "MANUFACTURER=WLLC;MODEL=APIClientWEB;SERIAL=123456789;OSVERSION=5.0",
                    Login: sessionStorage.getItem("login"),
                    AvatarHash: "",
                    StatusID: "AAAAAAAAAAAAAAAAAAAAAA=="
                  }
                }
              ];
              wsRef.current.send(JSON.stringify(devconf));
              break;
            case "CONFIG_SERVER_RESPONSE_NACK":
              alert(msg.Reason);
              break;
            case "CONFIG_SERVER_RESPONSE_ACK":
              let login = [{ MessageID: "LOGIN" }];
              wsRef.current.send(JSON.stringify(login));
              break;
            case "LOGIN_RESPONSE":
              if (msg.Response === 0) {
                sessionStorage.setItem("UserID", msg.UserID);
                initAudio();
              }
              break;
            case "DATAEX":
              switch (msg.DataType) {
                case 12: //Groups
                  ProcessDataexGroups(msg.DataObjects, msg.Operation);
                  break;
                case 10: //Devices
                  ProcessDataexDevices(msg.DataObjects, msg.Operation);
                  break;
                default:
                  break;
              }
              break;
            case "PTT_CONTROL":
              ProcessPTTControl(msg);
              break;
            case "VOICE_PACKET":
              process_voice_packet(msg);
              break;
            default:
              break;
          }
        }
      };

      const ProcessPTTControl = (msg) => {
        let control = msg.Control;
        let sourceId = msg.SourceID;
        let sourceName = msg.SourceName;
        let targetId = msg.TargetID;
        let targetName = msg.TargetName;
        let callId = msg.CallID;

        switch (control) {
          case 0: //VOICE_PRIVATE_BEGIN
          let pttConfirm = [
              {
                MessageID: "PTT_RESPONSE",
                Destination: sourceId,
                Response: 0,
                Type: 0
              }
            ];
            wsRef.current.send(JSON.stringify(pttConfirm));
            break;
          case 10: //VOICE_GROUP_ENTER
            activeCallIdRef.current = callId
            setActiveCallId(callId)
            setSelectedObjectType('group')
            setSelectedObjectName(targetName);
            setSelectedObjectId(targetId)
            break;
          case 9: //VOICE_PRIVATE_ENTER
            activeCallIdRef.current = callId
            setActiveCallId(callId)
            setSelectedObjectType('private')

            if (sourceId === getDeviceID()) {
              setSelectedObjectName(targetName);
              setSelectedObjectId(targetId)
            } else {
              setSelectedObjectName(sourceName);
              setSelectedObjectId(targetId)
            }
            break;
          case 1: //VOICE_PRIVATE_PRESSED
          case 5: //VOICE_GROUP_PRESSED
            if (activeCallIdRef.current === callId) {
              let isOnTransmit = sourceId === getDeviceID();
              isTransmitRef.current = isOnTransmit
              isReceiveRef.current = !isOnTransmit

              if (isTransmitRef.current) {
                pttButtonRef.current.style.backgroundColor = 'red'
              } else {
                pttButtonRef.current.style.backgroundColor = 'green'
              }
            }
            break;
          case 2: //VOICE_PRIVATE_RELEASED
          case 6: //VOICE_GROUP_RELEASED
            //StopAnnonceTimer();
            if (activeCallIdRef.current === callId) {
                setIsOnCall(true)
                pttButtonRef.current.style.backgroundColor = 'lightblue'
                isTransmitRef.current = false
                isReceiveRef.current = false
            }
            break;
          case 3: //VOICE_PRIVATE_END
          case 7: //VOICE_GROUP_END
            if (activeCallIdRef.current === callId) {
              setIsOnCall(false)
              pttButtonRef.current.style.backgroundColor = 'pink'

              //activeCallIdRef.current = ''
              setActiveCallId('')
            }
            break;
          default:
            break;
        }
      }

      const ProcessDataexGroups = (grps, dataOp) => {
        setListGroups(grps)
      }

      const ProcessDataexDevices = (devs, dataOp) => {
        // list of active users (include you)
        setListUsers(devs.filter(item => getDeviceID() !== item.ID))
      }

      function process_voice_packet(msg) {
        let udp = base64ToUint8Array(msg.Data);
        let alaw = new Uint8Array(udp.buffer, 12);
        let pcm = alawmulaw.alaw.decode(alaw);

        let audioFrame = new Float32Array(bufferSamplesCount);
        for (let i = 0; i < bufferSamplesCount; i++)
          audioFrame[i] = (1.0 * pcm[i]) / 32767;

          soundBufferRef.current.addChunk(audioFrame);
      }

      wsRef.current.onerror = function (evt) {
        console.log("Socket error: " + JSON.stringify(evt, null, 4));
      };

      wsRef.current.onclose = function (evt) {
        console.log("Socket closed. Code: " + evt.code);
      };
    } else {
      // The browser doesn't support WebSocket
      console.log("WebSocket NOT supported by your Browser!");
    }
  };

  const getBase64ID = () => {
    let array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    let b64 = "";
    for (let i = 0; i < array.length; i++) {
      b64 += String.fromCharCode(array[i]);
    }
    return window.btoa(b64);
  };

  const getDeviceID = () => {
    let deviceid = localStorage.getItem("DeviceID");
    if (deviceid == null) {
      deviceid = getBase64ID();
      localStorage.setItem("DeviceID", deviceid);
    }
    return deviceid;
  };

  const startPTT = () => {
    if (selectedObjectId === "") return;
    let pttrequest = [
      {
        MessageID: "PTT_REQUEST",
        Destination: selectedObjectId,
        Type: selectedObjectType === "group" ? 2 : 0
      }
    ];

    wsRef.current.send(JSON.stringify(pttrequest));
    startRecording();
  };

  const stopPTT = () => {
    if (selectedObjectId === "") return;
    let pttrequest = [
      {
        MessageID: "PTT_REQUEST",
        Destination: selectedObjectId,
        Type: selectedObjectType === "group" ? 3 : 1
      }
    ];
    wsRef.current.send(JSON.stringify(pttrequest));
    stopRecording();
  };

  const groupSelected = (id, name) => {
    setSelectedObjectId(id)
    setSelectedObjectName(name);
    setSelectedObjectType('group')
    setSelectedUserId('')
  };

  const userSelected = (id, userId, name) => {
    setSelectedObjectId(id)
    setSelectedObjectName(name);
    setSelectedObjectType('private')
    setSelectedUserId(userId)
  };

  const base64ToUint8Array = (base64string) => {
    let arrayBuffer = Uint8Array.from(atob(base64string), function (c) {
      return c.charCodeAt(0);
    });
    return arrayBuffer;
  };

  const uint8ArrayToBase64 = (arrayBuffer) => {
    let base64 = btoa(
      arrayBuffer.reduce((data, byte) => data + String.fromCharCode(byte), "")
    );
    return base64;
  };

  let sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

  const process_microphone_frame = () => {
    let udpPacket = new Uint8Array(udpPacketBuffer);
    // header
    udpPacket[0] = 2 << 6; // udp version = 2
    udpPacket[1] = 106; // voice call
    sequenceNumber++;
    udpPacket[2] = (sequenceNumber >> 8) & 0xff;
    udpPacket[3] = sequenceNumber & 0xff;

    udpPacket[8] = (ssrc >> 0x18) & 0xff;
    udpPacket[9] = (ssrc >> 0x10) & 0xff;
    udpPacket[10] = (ssrc >> 8) & 0xff;
    udpPacket[11] = ssrc & 0xff;

    let alaw = alawmulaw.alaw.encode(currentFrame);
    udpPacket.set(alaw, 12);

    let str = uint8ArrayToBase64(udpPacket);
    let login = [{ MessageID: "VOICE_PACKET", Data: str }];
    wsRef.current.send(JSON.stringify(login));
  };

  const initAudio = () => {
    sampleRate = sessionStorage.getItem("AudioSampleRate");

    audioContextRef.current = new AudioContext({ sampleRate: sampleRate });

    if (!navigator.getUserMedia)
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

    if (navigator.getUserMedia) {
      navigator.getUserMedia(
        { audio: true },
        function (stream) {
          microphoneStreamRef.current = audioContextRef.current.createMediaStreamSource(stream);
          let chunkSize = 2048;
          audioProcessorNodeRef.current = audioContextRef.current.createScriptProcessor(
            chunkSize,
            1,
            1
          );
          audioProcessorNodeRef.current.onaudioprocess = function (data) {
            let leftChannel = data.inputBuffer.getChannelData(0);
            let index = 0;
            while (index < chunkSize) {
              while (
                currentBufferIndex < bufferSamplesCount &&
                index < chunkSize
              ) {
                currentFrame[currentBufferIndex] = leftChannel[index] * 32767;
                index++;
                currentBufferIndex++;
              }

              if (currentBufferIndex === bufferSamplesCount) {
                currentBufferIndex = 0;
                process_microphone_frame();
              }
            }
          };
        },
        function (e) {
          console.log("Error capturing audio.");
        }
      );
    } else {
      console.log("getUserMedia not supported in this browser.");
    }

    soundBufferRef.current = new SoundBuffer(audioContextRef.current, sampleRate, 10, 3, true);
  };

  const startRecording = () => {
    audioContextRef.current.resume();
    microphoneStreamRef.current.connect(audioProcessorNodeRef.current);
    audioProcessorNodeRef.current.connect(audioContextRef.current.destination);
  };

  const stopRecording = () => {
    microphoneStreamRef.current.disconnect(audioProcessorNodeRef.current);
    audioProcessorNodeRef.current.disconnect(audioContextRef.current.destination);
  };

  useEffect(() => {
    runWebsocket();

    return () => {
        wsRef.current.close()
    }
  }, []);

  return (
    <div className="App">
      {/* GROUPS */}
      <div className="section">GROUPS</div>

      <select
        id="GroupList"
        size="7"
        className="select"
        value={selectedObjectName}
        disabled={isOnCall}
      >
        <option value=''></option>
        {listGroups.map(item => (
          <option key={item.ID} value={item.Name} onClick={() => {
            groupSelected(item.ID, item.Name)
          }} disabled={isOnCall}>{item.Name}</option>
        ))}
      </select>

      {/* USERS */}
      <div className="section">USERS</div>

      <select
        id="UserList"
        size="10"
        className="select"
        value={selectedObjectName}
      >
        <option value=''></option>
        {listUsers.map(item => (
          <option key={item.ID} value={item.UserName} onClick={() => {
            userSelected(item.ID, item.UserId, item.UserName)
          }}>{item.UserName}</option>
        ))}
      </select>

      {/* SELECTED OBJECT */}
      <div id="SelectedObject" className="selobj">{selectedObjectName}</div>

      {/* PTT BUTTON */}
      <button
        ref={pttButtonRef}
        id="pttBtn"
        className="pttbtn"
        style={{ backgroundColor: 'lightgray' }}
        onMouseDown={startPTT}
        onMouseUp={stopPTT}
      >
        PTT
      </button>
    </div>
  );
};

export default Home;
