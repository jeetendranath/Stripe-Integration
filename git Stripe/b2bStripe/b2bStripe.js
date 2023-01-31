
import { LightningElement,api,wire } from 'lwc';
import getPaymentInfo from '@salesforce/apex/B2BPaymentController.getPaymentInfo';
import { NavigationMixin } from 'lightning/navigation';
import setPaymentInfo from '@salesforce/apex/B2BPaymentController.setPaymentInfo';

import getVFOrigin from '@salesforce/apex/B2BPaymentController.getVFOrigin';

import updatePAError from '@salesforce/apex/B2BPaymentController.updatePaymentAuthError';

import submitCreditCardOrder from '@salesforce/apex/B2BPaymentController.submitCreditCardOrder';

import isCreditAvailable from '@salesforce/apex/B2BPaymentController.isCreditAvailable';

import getCreditLimit from '@salesforce/apex/B2BPaymentController.getCreditLimit';

import updateAvailableCredit from '@salesforce/apex/B2BPaymentController.updateAvailableCredit';
import updatePaymentMethod from '@salesforce/apex/AddressController.updatePaymentMethod';




import {ShowToastEvent} from 'lightning/platformShowToastEvent';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';

export default class B2bStripe extends LightningElement {

    @api cartId;
    @api PONumber;
    @api paymentType = 'PurchaseOrderNumber';
    @api isCreditAvailable = false;
    cart;
    iframeUrl;
    availableCreditLimit;
    grandTotal;
    hideButton;
    // Wire getVFOrigin Apex method to a Property
    @wire(getVFOrigin)
    vfOrigin;

    canPay = false;
    stripeCustomerId = '';
    iframeUrl;
    showSpinner = false;
    connectedCallback() {
        window.addEventListener("message", this.handleVFResponse.bind(this));
        let dataMap = {
            cartId: this.cartId
        };
        this.showSpinner = true;
        
        /* this method gets the information about the customer pay or not and the StripecustomerId and iframe url*/

        /*Stripe information create this iframe URL and return the response back to the back to the front end.*/
        getPaymentInfo({
            dataMap: dataMap
        }).then((result) => {
                this.showSpinner = false;
                console.log(result);
                if (result && result.isSuccess) {
                    this.canPay = result.canPay;
                    this.cart = result.cart;
                    this.stripeCustomerId = result.stripeCustomerId ;
                    this.iframeUrl = result.iframeUrl;
                } else {
                    this.showToast('No payment Methods Found', 'error');
                }
            })
            .catch((e) => {
                this.showToast(
                    'Some Error occured while processing this Opportunity,Please contact System admin.',
                    'error'
                );
            });

            isCreditAvailable({cartId : this.cartId})
            .then((result)=>{
                console.log('Is Credit Available : '+result);

                if(result == true)
                {
                    this.isCreditAvailable = true;
                }
                else{
                    this.isCreditAvailable = false;
                }
            });

            getCreditLimit({cartId : this.cartId})
            .then((result)=>{
                console.log('Credit Limit :'+ result.CreditLimit);
                console.log('Grand Total :'+ result.grandTotal);
                this.availableCreditLimit = result.CreditLimit;
                this.grandTotal = result.grandTotal;
            })
            

    }

    showValue(){
        this.hideButton = true;
    }
    hideValue(){
        this.hideButton = false;
    }

    PONumberHandler(event){
        this.PONumber=event.target.value;
    }

    creditCardTab(){
        this.paymentType = 'CardPayment' ;
        this.updatePayment();
        console.log('Payment Type : '+this.paymentType);
    }

    PONumberTab(){
        this.paymentType = 'PurchaseOrderNumber';
        this.updatePayment();
        console.log('Payment Type : '+this.paymentType);
    }





    showToast(message ,variant) {
        let title = variant == 'error' ? 'Error' : 'Success';
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }

    handleVFResponse(message){
        console.log('handleVFResponse');
        console.log(message);
        var cmp = this;
        if (message.origin === this.vfOrigin.data) {
            let receivedMessage = message.data;
            if(receivedMessage && receivedMessage != null){
                if(receivedMessage.hasOwnProperty('paId')){
                    let dataMap = {
                        paId: receivedMessage.paId
                    }
                    updatePAError({dataMap: dataMap})
                    .then(function (result) {
                        cmp.showSpinner = false;
                    });
                }else{
                    if(receivedMessage.cToken && receivedMessage.cToken != null &&  receivedMessage.cToken.token && receivedMessage.cToken.token != null){
                        if(this.submitOrderCalled){
                            return ;
                        }
                        this.submitOrderCalled = true;
                        this.submitCCOrder(receivedMessage);
                    }
                }
            }
        }
    }

    submitCCOrder(receivedMessage){
        let dataMap = {
            "cartId": this.cartId,
            "paymentMethod": 'CC',
            "stripeCustomerId": this.stripeCustomerId,
            "cToken": receivedMessage.cToken.token,
            "cPay" : receivedMessage.cPay.paymentIntent,
            "cTokenId": receivedMessage.cToken.token.id,
            "cPayId" : receivedMessage.cPay.paymentIntent.id
        };
        submitCreditCardOrder({
            dataMap: dataMap
        }).then((result) => {
            this.showSpinner = false;
            if(result && result.isSuccess){
                const navigateNextEvent = new FlowNavigationNextEvent();
                this.dispatchEvent(navigateNextEvent);
            }else{
                this.showToast(result.msg,'error');
            }
        }).catch((e) => {
            this.showToast(
                e.message,
                'error'
            );
        });
    }

    errorCallback(err) {
        alert(err);
    }

    updatePayment(){
        updatePaymentMethod({cartId: this.cartId,paymentMethod : this.paymentType})
        .then((result)=>{
            console.log('Payment Type '+ result);
        })
        .catch((e)=>{
            console.log('** error' + JSON.stringify(e));
        })
    }

    submitOrder(){

        if(this.paymentType=='PurchaseOrderNumber')
        {

            if(this.grandTotal < this.availableCreditLimit)
            {
                updateAvailableCredit({cartId: this.cartId})
                .then((result)=>{
                    console.log(result);
                    
                }).catch((e) => {
                    console.log('** error' + JSON.stringify(e));
                });

                const navigateNextEvent = new FlowNavigationNextEvent();
                this.dispatchEvent(navigateNextEvent);

            }
            else{
                const event = new ShowToastEvent({
                    title: 'Error',
                    variant: 'error',
                    message: ':( Sorry,You did not have enough limit in your card',
                });
                this.dispatchEvent(event);
            }
            


        }
        

        else{           

            let dataMap = {
                "cartId": this.cartId,
                "paymentMethod": 'CC',
                "stripeCustomerId": this.stripeCustomerId
            };
            this.showSpinner = true;
            setPaymentInfo({
                dataMap: dataMap
            }).then((result) => {
                
                if(result && result.PI_Secret){
                    result.billing_details = {
                        name : this.cart.CreatedBy.Name,
                        email : this.cart.CreatedBy.Email
                    };
                    this.handleFiretoVF(result);
                }
            }).catch((e) => {
                this.showToast(
                    e.message,
                    'error'
                );
            });

            



        }
        
    }

    handleFiretoVF(message) {
        console.log('handleFiretoVF');
        this.template.querySelector("iframe").contentWindow.postMessage(message, this.vfOrigin.data);
    }

    
}