import React, {useState} from 'react';
import './App.css';
import {Types, AptosClient, AptosAccount} from 'aptos';

const G_CONFIG = "::streampay::GlobalConfig";

// Create an AptosClient to interact with testnet.
const client = new AptosClient('https://fullnode.testnet.aptoslabs.com/v1');

/** Convert string to hex-encoded utf-8 bytes. */
function hexStringToUint8Array(hexString: string){
    if (hexString.length % 2 !== 0){
        throw "Invalid hexString";
    }
    var arrayBuffer = new Uint8Array(hexString.length / 2);

    for (var i = 0; i < hexString.length; i += 2) {
        var byteValue = parseInt(hexString.substr(i, 2), 16);
        if (isNaN(byteValue)){
            throw "Invalid hexString";
        }
        arrayBuffer[i/2] = byteValue;
    }

    return arrayBuffer;
}


function App() {
    const [receiverAddr, setReceiverAddr] = useState("");
    const [amount, setAmount] = useState("10000");
    const [startTime, setStartTime] = useState('1000');
    const [stopTime, setStopTime] = useState('10000');
    const [coinId, setCoinId] = useState('0');

    // Retrieve aptos.account on initial render and store it.
    const [address, setAddress] = React.useState<string>("0x");
    React.useEffect( () => {
        window.aptos.connect().then(() => {
            window.aptos.account().then((data : {address: string}) => {
                setAddress(data.address);
                // setAddress("0xb5add92f1f60ae106e8ac7712fd71d550c36ed3bc33fa6004fe4a1d1bcc91bb5");
                setReceiverAddr(data.address);
            });
        });
    }, []);


    // Use the AptosClient to retrieve details about the account.
    const [account, setAccount] = React.useState<Types.AccountData | null>(null);
    React.useEffect(() => {
        if (!address) return;
        client.getAccount(address).then(setAccount);
    }, [address]);

    const [resources, setResources] = React.useState<Types.MoveResource[]>([]);
    React.useEffect(() => {
        if (!address) return;
        client.getAccountResources(address).then(setResources);
    }, [address]);

    // Check for the module; show publish instructions if not present.
    const [modules, setModules] = React.useState<Types.MoveModuleBytecode[]>([]);
    React.useEffect(() => {
        if (!address) return;
        client.getAccountModules(address).then(setModules);
    }, [address]);

    // Call set_message with the textarea value on submit.
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        const transaction = {
            type: "entry_function_payload",
            function: `${address}::streampay::create`,
            arguments: [receiverAddr, amount, startTime, stopTime, coinId],
            type_arguments: ["0x1::aptos_coin::AptosCoin"],
        };
        console.log("transaction payload", transaction);
        try {
            await window.aptos.signAndSubmitTransaction(transaction);
            console.log("Stream Created!")
        } finally {
        }
    };

    const [newStopTime, setNewStopTime] = useState('20000');
    const [coinIdExt, setCoinIdExt] = useState('0');
    const [streamId, setStreamId] = useState('0');

    // Todo: Sign tx by wallet plugin instead of local private key
    const hex = process.env.REACT_APP_TMP_KEY!
        .replace("0x", "")
        .replace("0X", "")
        .trim();
    const pkHex = hexStringToUint8Array(hex);
    const account1 = new AptosAccount(pkHex);

    // query table from handle in resources
    if(resources.length > 0) {
        // console.log("modules", modules);
        // console.log("resources", resources);
        const resGlConf = resources.find((r) => r.type.includes(G_CONFIG))!;
        const moveData = JSON.parse(JSON.stringify(resGlConf.data!));
        const streamHandle = moveData.input_stream.handle;

        const tbReqStreamInd = {
            key_type: "address",
            value_type: `vector<${address}::streampay::StreamIndex>`,
            key: address,
        };
        // console.log("streamHandle", streamHandle);
        // console.log("getTokenTableItemRequest", tbReqStreamInd);
        client.getTableItem(streamHandle, tbReqStreamInd).then(console.log).catch(console.error);

        const hdStreamInfo = moveData.coin_configs[0].store.handle;
        const tbReqStreamInfo = {
            key_type: "u64",
            value_type: `vector<${address}::streampay::StreamInfo>`,
            key: "1",
        };
        // console.log("hdStreamInfo", hdStreamInfo);
        // console.log("tbReqStreamInfo", tbReqStreamInfo);
        // client.getTableItem(hdStreamInfo, tbReqStreamInfo).then(console.log).catch(console.error);
    }

    const handleSubmitExtend = async (e: any) => {
        e.preventDefault();
        const transaction = {
            type: "entry_function_payload",
            function: `${address}::streampay::extend`,
            arguments: [newStopTime, coinIdExt, streamId],  // arguments: ["90000", "0", "0"],
            type_arguments: ["0x1::aptos_coin::AptosCoin"],
        };
        console.log("transaction payload", transaction);
        try {
            let txnRequest = await client.generateTransaction(account1.address(), transaction);
            let signedTxn = await client.signTransaction(account1, txnRequest);
            let transactionRes = await client.submitTransaction(signedTxn);
            await client.waitForTransaction(transactionRes.hash);
            console.log("Stream Extended!")
        } finally {
        }
    };

    const [coinIdWdr, setCoinIdWdr] = useState('0');
    const [streamIdWdr, setStreamIdWdr] = useState('0');

    const handleSubmitWithdraw = async (e: any) => {
        e.preventDefault();
        const transaction = {
            type: "entry_function_payload",
            function: `${address}::streampay::withdraw`,
            arguments: [coinIdWdr, streamIdWdr],
            type_arguments: ["0x1::aptos_coin::AptosCoin"],
        };
        console.log("transaction payload", transaction);
        try {
            let txnRequest = await client.generateTransaction(account1.address(), transaction);
            let signedTxn = await client.signTransaction(account1, txnRequest);
            let transactionRes = await client.submitTransaction(signedTxn);
            await client.waitForTransaction(transactionRes.hash);
            console.log("Stream Withdrawed!")
        } finally {
        }
    };

    return (
        <div className="App">
            <p><code>"address":{ address }</code></p>

            <p><h3>{ "Create Stream" }</h3></p>
            <form onSubmit={handleSubmit}>
                <label>Receiver Address</label><br/>
                <input type="text" value={receiverAddr}  onChange={(e) => setReceiverAddr(e.target.value)}/><br/>
                <label>Amount</label><br/>
                <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)}/><br/>
                <label>Start Time</label><br/>
                <input type="text" value={startTime}  onChange={(e) => setStartTime(e.target.value)}/><br/>
                <label>Stop Time</label><br/>
                <input type="text" value={stopTime}  onChange={(e) => setStopTime(e.target.value)}/><br/>
                <label>Coin Id</label><br/>
                <input type="text" value={coinId}  onChange={(e) => setCoinId(e.target.value)}/><br/>
                <input type="submit" value="Submit"/>
            </form>


            <p><h3>{ "Extend Stream" }</h3></p>
            <form onSubmit={handleSubmitExtend}>

                <label>New Stop Time</label><br/>
                <input type="text" value={newStopTime}
                       onChange={(e) => setNewStopTime(e.target.value)}/><br/>
                <label>Coin Id</label><br/>
                <input type="text" value={coinIdExt}
                       onChange={(e) => setCoinIdExt( e.target.value)}/><br/>
                <label>Stream Id</label><br/>
                <input type="text" value={streamId}
                       onChange={(e) => setStreamId(e.target.value)}/><br/>
                <input type="submit" value="Submit"/>
            </form>

            <p><h3>{ "Withdraw Stream" }</h3></p>
            <form onSubmit={handleSubmitWithdraw}>

                <label>Coin Id</label><br/>
                <input type="text" value={coinIdWdr}
                       onChange={(e) => setCoinIdWdr( e.target.value)}/><br/>
                <label>Stream Id</label><br/>
                <input type="text" value={streamIdWdr}
                       onChange={(e) => setStreamIdWdr(e.target.value)}/><br/>
                <input type="submit" value="Submit"/>
            </form>

        </div>


    );
}

export default App;
