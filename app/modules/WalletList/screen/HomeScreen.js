import React, { Component } from 'react'
import {
  View,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  Clipboard,
  Text
} from 'react-native'
import PropTypes from 'prop-types'
import FCM from 'react-native-fcm'
import Carousel, { getInputRangeFromIndexes } from 'react-native-snap-carousel'
import { observer } from 'mobx-react/native'
import { computed } from 'mobx'
import { getStatusBarHeight } from 'react-native-status-bar-height'
import LargeCard from '../elements/LargeCard'
import Hamburger from '../elements/HamburgerButton'
import SettingScreen from '../../Setting/screen/SettingScreen'
import HomeSendButton from '../elements/HomeSendButton'
import LayoutUtils from '../../../commons/LayoutUtils'
import NotificationListenter from '../../../NotificationListener'
import NotificationStore from '../../../stores/NotificationStore'
import AppStyle from '../../../commons/AppStyle'
import constant from '../../../commons/constant'
import MainStore from '../../../AppStores/MainStore'
import NavStore from '../../../stores/NavStore'
import Config from '../../../AppStores/stores/Config'
import Ticker from '../elements/Ticker'
import TickerStore from '../stores/TickerStore'

const marginTop = LayoutUtils.getExtraTop()
const { width, height } = Dimensions.get('window')
const heightCarousel = height - 200 - marginTop + 60

@observer
export default class HomeScreen extends Component {
  static propTypes = {
    navigation: PropTypes.object
  }

  static defaultProps = {
    navigation: {}
  }

  constructor(props) {
    super(props)
    NotificationListenter.registerAppListener(this.props.navigation)
    FCM.setBadgeNumber(0)
    this.state = {
      translateY: new Animated.Value(0)
    }
  }

  componentDidMount() {
    TickerStore.callApi()
    setTimeout(() => {
      if (!NotificationStore.isInitFromNotification) {
        MainStore.gotoUnlock()
        this.props.navigation.navigate('UnlockScreen', {
          isLaunchApp: true,
          onUnlock: () => {
            this._gotoCreateWallet()
          }
        })
      } else {
        this.props.navigation.navigate('TransactionDetailScreen', NotificationStore.transactionFromNotif)
      }
    }, 100)
  }

  onSendPress = () => {
    const { navigation } = this.props
    const { selectedWallet } = MainStore.appState
    MainStore.goToSendTx()
    MainStore.appState.setselectedToken(selectedWallet.tokens[0])
    MainStore.sendTransaction.changeIsToken(false)
    navigation.navigate('SendTransactionStack')
  }

  onSnapToItem = (index) => {
    if (this.cards[index].address === '0') {
      MainStore.appState.setSelectedWallet(null)
    } else {
      MainStore.appState.setSelectedWallet(MainStore.appState.wallets[index])
    }
  }

  // @computed get selectedWalletIndex() {
  //   const wallet = MainStore.appState.selectedWallet
  //   if (!wallet) return 0

  //   console.warn(wallet)
  //   let index = 0
  //   MainStore.appState.wallets.forEach((w, i) => {
  //     if (w.address === wallet.address) {
  //       index = i
  //     }
  //   })

  //   setTimeout(() => this._carousel && this._carousel.snapToItem(index, true), 0)
  // }

  _renderNetwork = () => {
    let currentNetwork = MainStore.appState.config.network
    let color = { backgroundColor: AppStyle.mainColor }
    if (currentNetwork === Config.networks.mainnet) {
      color = { backgroundColor: AppStyle.colorUp }
    }
    currentNetwork = currentNetwork.replace(/^\w/, c => c.toUpperCase())
    return (
      <View style={styles.networkField}>
        <View style={[styles.dot, color]} />
        <Text style={styles.networkText}>{`Active Network: ${currentNetwork}`}</Text>
      </View>
    )
  }

  _renderSendButton = () =>
    (
      <HomeSendButton
        action={this.onSendPress}
      />
    )

  _gotoCreateWallet() {
    this.props.navigation.navigate('CreateWalletStack')
  }

  _renderCard = ({ item, index }) =>
    (
      <LargeCard
        index={index}
        style={{ margin: 5, marginTop: 20 }}
        navigation={this.props.navigation}
        onPress={() => {
          index !== this.wallets.length
            ? this.props.navigation.navigate('TokenScreen', { index })
            : this._gotoCreateWallet()
        }}
        onAddPrivateKey={() => {
          this.props.navigation.navigate('ImplementPrivateKeyScreen')
        }}
        onBackup={async () => {
          await MainStore.gotoBackup()
          this.props.navigation.navigate('BackupScreen')
        }}
        onCopy={() => {
          Clipboard.setString(MainStore.appState.selectedWallet.address)
          NavStore.showToastTop('Copied', {}, { color: AppStyle.mainColor })
        }}
      />
    )

  stackScrollInterpolator = (index, carouselProps) => {
    const range = [1, 0, -1, -2, -3]
    const inputRange = getInputRangeFromIndexes(range, index, carouselProps)
    const outputRange = range
    return { inputRange, outputRange }
  }

  stackAnimatedStyles = (index, animatedValue, carouselProps) => {
    const sizeRef = carouselProps.vertical ? carouselProps.itemHeight : carouselProps.itemWidth
    const translateProp = carouselProps.vertical ? 'translateY' : 'translateX'

    const cardOffset = 18
    const card1Scale = 0.9
    const card2Scale = 0.8

    const getTranslateFromScale = (index2, scale) => {
      const centerFactor = 1 / scale * index2
      const centeredPosition = -Math.round(sizeRef * centerFactor)
      const edgeAlignment = Math.round((sizeRef - (sizeRef * scale)) / 2)
      const offset = Math.round(cardOffset * Math.abs(index2) / scale)

      return centeredPosition - edgeAlignment - offset
    }

    return {
      opacity: animatedValue.interpolate({
        inputRange: [-3, -2, -1, 0],
        outputRange: [0, 0.5, 0.75, 1],
        extrapolate: 'clamp'
      }),
      transform: [{
        scale: animatedValue.interpolate({
          inputRange: [-2, -1, 0, 1],
          outputRange: [card2Scale, card1Scale, 1, card1Scale],
          extrapolate: 'clamp'
        })
      }, {
        [translateProp]: animatedValue.interpolate({
          inputRange: [-3, -2, -1, 0, 1],
          outputRange: [
            getTranslateFromScale(-3, card2Scale),
            getTranslateFromScale(-2, card2Scale),
            getTranslateFromScale(-1, card1Scale),
            0,
            sizeRef * 0.5
          ],
          extrapolate: 'clamp'
        })
      }]
    }
  }

  checkPrivateKey(privateKey) {
    return privateKey !== undefined && privateKey !== ''
  }

  render() {
    const { navigation } = this.props
    const {
      translateY
    } = this.state
    const changeOpacityListCoin = translateY.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp'
    })
    const changeOpacitySetting = translateY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp'
    })
    this.wallets = MainStore.appState.wallets.slice()
    this.cards = this.wallets
    if (this.cards.length < 5) {
      this.cards = [...this.cards, {
        balance: '0 ETH',
        balanceUSD: '$0',
        address: '0'
      }]
    }
    const tickers = TickerStore.tickers.slice()

    return (
      <View style={styles.container}>
        <View style={styles.homeHeader}>
          <Hamburger
            onPressHamburger={(isShow) => {
              Animated.timing(
                translateY,
                {
                  toValue: isShow ? 1 : 0,
                  duration: 250
                }
              ).start()
            }}
          />
          <View>
            <Animated.View
              style={{
                overflow: 'hidden',
                opacity: changeOpacityListCoin,
                position: 'absolute',
                top: 2,
                height: 60,
                width: width - 77
              }}
            >
              <Ticker
                data={tickers}
                style={{
                  width: width - 77
                }}
              />
            </Animated.View>
            <Animated.Text
              style={{
                opacity: changeOpacitySetting,
                fontSize: 20,
                color: AppStyle.mainTextColor,
                fontFamily: 'OpenSans-Bold'
              }}
            >
              {constant.SETTING}
            </Animated.Text>
          </View>
        </View>
        <View style={{ height: heightCarousel }}>
          <Carousel
            removeClippedSubviews={false}
            ref={(c) => { this._carousel = c }}
            data={this.cards}
            layout="default"
            renderItem={this._renderCard}
            sliderWidth={width}
            itemWidth={width - 72}
            inactiveSlideOpacity={1}
            keyExtractor={item => item.address}
            onSnapToItem={this.onSnapToItem}
          // firstItem={this.selectedWalletIndex}
          />
        </View>
        <View
          style={styles.bottomField}
        >
          {this._renderNetwork()}
          {this._renderSendButton()}
        </View>
        <Animated.View
          style={{
            position: 'absolute',
            top: 71 + marginTop,
            width,
            height: height - 71 - marginTop,
            transform: [
              {
                translateY: translateY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height - 56 + getStatusBarHeight(), Platform.OS === 'ios' ? 0 : getStatusBarHeight()],
                  extrapolate: 'clamp',
                  useNativeDriver: true
                })
              }
            ]
          }}
        >
          <SettingScreen
            navigation={navigation}
            onCreated={(index, isCreate, isAddress) => {
              this._carousel.snapToItem(index)
            }}
          />
        </Animated.View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: marginTop + 20,
    paddingLeft: 10,
    paddingBottom: 15
  },
  networkField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20
  },
  bottomField: {
    marginTop: -20,
    flex: 1,
    marginLeft: 36,
    marginRight: 20,
    justifyContent: 'space-between',
    flexDirection: 'row'
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  networkText: {
    fontSize: 12,
    fontFamily: 'OpenSans-Semibold',
    marginLeft: 4,
    color: AppStyle.mainTextColor
  }
})
