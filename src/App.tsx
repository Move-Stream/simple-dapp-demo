import React, {useState} from 'react';
import './App.css';
import {Types, AptosClient, AptosAccount} from 'aptos';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

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

type StreamInfo = {
    coin_id: string,
    stream_id: string,
    sender: string,
    recipient: string,
    rate_per_second: string,
    start_time: string,
    stop_time: string,
    last_withdraw_time: string,
    deposit_amount: string,
    remaining_balance: string,

}

function App() {
    const [coins, setCoins] = useState<string[]>([]);
    const [address, setAddress] = React.useState<string>("");
    const [rows, setRows] = useState<StreamInfo[]>([]);

    React.useEffect( () => {
        window.aptos.connect().then(() => {
            window.aptos.account().then((data : {address: string}) => {
                setAddress(data.address);
                // setAddress("0xb5add92f1f60ae106e8ac7712fd71d550c36ed3bc33fa6004fe4a1d1bcc91bb5");
                setReceiverAddr(data.address);
                setCoins(["0x1::aptos_coin::AptosCoin",
                    `${data.address}::Coins::XBTC`,
                    `${data.address}::Coins::XETH`,
                    `${data.address}::Coins::XDOT`,
                    `${data.address}::Coins::TestCoin`
                ]);
            });
        });
    }, []);


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

    const [modules, setModules] = React.useState<Types.MoveModuleBytecode[]>([]);
    React.useEffect(() => {
        if (!address && !Object.keys(coins).length) return;
        client.getAccountModules(address).then(setModules);
    }, [address]);

    const [receiverAddr, setReceiverAddr] = useState("");
    const [amount, setAmount] = useState("10000");
    const [startTime, setStartTime] = useState('1000');
    const [stopTime, setStopTime] = useState('10000');
    const [coinId, setCoinId] = useState('0');
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        const transaction = {
            type: "entry_function_payload",
            function: `${address}::streampay::create`,
            arguments: [receiverAddr, amount, startTime, stopTime, coinId],
            type_arguments: [coins[Number(coinId)]],
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
    const [streamId, setStreamId] = useState('1');
    const handleSubmitExtend = async (e: any) => {
        e.preventDefault();
        const transaction = {
            type: "entry_function_payload",
            function: `${address}::streampay::extend`,
            arguments: [newStopTime, coinIdExt, streamId],
            type_arguments: [coins[Number(coinIdExt)]],
        };
        console.log("transaction payload", transaction);
        try {
            await window.aptos.signAndSubmitTransaction(transaction);
            console.log("Stream Extended!")
        } finally {
        }
    };

    const [coinIdWdr, setCoinIdWdr] = useState('0');
    const [streamIdWdr, setStreamIdWdr] = useState('1');
    const handleSubmitWithdraw = async (e: any) => {
        e.preventDefault();
        const transaction = {
            type: "entry_function_payload",
            function: `${address}::streampay::withdraw`,
            arguments: [coinIdWdr, streamIdWdr],
            type_arguments: [coins[Number(coinIdWdr)]],
        };
        console.log("transaction payload", transaction);
        try {
            await window.aptos.signAndSubmitTransaction(transaction);
            console.log("Stream Withdrawed!")
        } finally {
        }
    };

    // query table from handle in resources
    React.useEffect(() => {
        if (resources.length <= 0) return;
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
        client.getTableItem(streamHandle, tbReqStreamInd).then(async streamIndice => {
            console.log("stream index", streamIndice);
            let _rows: StreamInfo[] = [];
            for (const ind of streamIndice) {
                console.log("stream index", ind);
                const {coin_id, stream_id} = ind;

                const hdStreamInfo = moveData.coin_configs[coin_id].store.handle;
                const tbReqStreamInfo = {
                    key_type: "u64",
                    value_type: `${address}::streampay::StreamInfo`,
                    key: stream_id.toString(),
                };

                // console.log("hdStreamInfo", hdStreamInfo);
                await client.getTableItem(hdStreamInfo, tbReqStreamInfo).then(x => {
                    // console.log("stream info", x);
                    _rows.push({coin_id: coin_id.toString(), stream_id: stream_id.toString(),  ...x});
                }).catch(console.error);
            }
            console.log("_rows", _rows);
            setRows(_rows);
        })
        .catch(console.error);

    }, []);

    return (
        <div className="App">

            <p><code>address:{ address }</code></p>

            <p><code>Input Stream</code></p>

            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell align="right">coin_id</TableCell>
                            <TableCell align="right">stream_id</TableCell>
                            <TableCell align="right">sender</TableCell>
                            <TableCell align="right">recipient</TableCell>
                            <TableCell align="right">rate_per_second</TableCell>
                            <TableCell align="right">start_time</TableCell>
                            <TableCell align="right">stop_time</TableCell>
                            <TableCell align="right">last_withdraw_time</TableCell>
                            <TableCell align="right">deposit_amount</TableCell>
                            <TableCell align="right">remaining_balance</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow
                                key={row.coin_id + row.stream_id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell component="th" scope="row">
                                    {row.coin_id}
                                </TableCell>
                                <TableCell align="right">{row.stream_id}</TableCell>
                                <TableCell align="right">{row.sender}</TableCell>
                                <TableCell align="right">{row.recipient}</TableCell>
                                <TableCell align="right">{row.rate_per_second}</TableCell>
                                <TableCell align="right">{row.start_time}</TableCell>
                                <TableCell align="right">{row.stop_time}</TableCell>
                                <TableCell align="right">{row.last_withdraw_time}</TableCell>
                                <TableCell align="right">{row.deposit_amount}</TableCell>
                                <TableCell align="right">{row.remaining_balance}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

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
